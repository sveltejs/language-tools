import MagicString from 'magic-string';
import { IfScope } from './if-scope';
import { TemplateScopeManager } from './template-scope';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { BaseNode } from '../../interfaces';
import { extractConstTags } from './const-tag';
import { withTrailingPropertyAccess } from '../utils/node-utils';

/**
 * Transform {#await ...} into something JSX understands
 */
export function handleAwait(
    htmlx: string,
    str: MagicString,
    awaitBlock: BaseNode,
    ifScope: IfScope,
    templateScopeManager: TemplateScopeManager
): void {
    // {#await somePromise then value} ->
    // {() => {let _$$p = (somePromise);
    let ifCondition = ifScope.getFullCondition();
    ifCondition = ifCondition ? surroundWithIgnoreComments(`if(${ifCondition}) {`) : '';
    templateScopeManager.awaitEnter(awaitBlock);
    const constRedeclares = ifScope.getConstDeclaration();
    str.overwrite(
        awaitBlock.start,
        awaitBlock.expression.start,
        `{() => {${constRedeclares}${ifCondition}let _$$p = (`
    );

    // {/await} ->
    // <>})}
    const awaitEndStart = htmlx.lastIndexOf('{', awaitBlock.end - 1);
    str.overwrite(awaitEndStart, awaitBlock.end, '</>})}}' + (ifCondition ? '}' : ''));
}

export function handleAwaitPending(
    awaitBlock: BaseNode,
    htmlx: string,
    str: MagicString,
    ifScope: IfScope
): void {
    if (awaitBlock.pending.skip) {
        return;
    }

    // {await aPromise} ...  ->  aPromise); (possibleIfCondition &&)<> ... </>
    const pendingStart = htmlx.indexOf('}', awaitBlock.expression.end);
    const pendingEnd = !awaitBlock.then.skip
        ? awaitBlock.then.start
        : !awaitBlock.catch.skip
        ? awaitBlock.catch.start
        : htmlx.lastIndexOf('{', awaitBlock.end);
    str.overwrite(
        withTrailingPropertyAccess(str.original, awaitBlock.expression.end),
        pendingStart + 1,
        ');'
    );
    str.appendRight(pendingStart + 1, ` ${ifScope.addPossibleIfCondition()}<>`);
    str.appendLeft(pendingEnd, '</>; ');

    if (!awaitBlock.then.skip) {
        return;
    }
    // no need to prepend ifcondition here as we know the then block is empty
    str.appendLeft(pendingEnd, '__sveltets_1_awaitThen(_$$p, () => {<>');
}

export function handleAwaitThen(
    awaitBlock: BaseNode,
    htmlx: string,
    str: MagicString,
    ifScope: IfScope
): void {
    if (awaitBlock.then.skip) {
        return;
    }

    // then value } | then} | {:then value} | {await ..} .. {/await} ->
    // __sveltets_1_awaitThen(_$$p, (value) => {(possibleIfCondition && )<>
    let thenStart: number;
    let thenEnd: number;
    // then value } | {:then value}
    if (!awaitBlock.pending.skip) {
        // {await ...} ... {:then ...}
        // thenBlock includes the {:then}
        thenStart = awaitBlock.then.start;
        if (awaitBlock.value) {
            thenEnd = htmlx.indexOf('}', awaitBlock.value.end) + 1;
        } else {
            thenEnd = htmlx.indexOf('}', awaitBlock.then.start) + 1;
        }
    } else {
        // {await ... then ...}
        thenStart = htmlx.indexOf('then', awaitBlock.expression.end);
        thenEnd = htmlx.lastIndexOf('}', awaitBlock.then.start) + 1;
        // somePromise then -> somePromise); then
        str.overwrite(awaitBlock.expression.end, thenStart, '); ');
    }

    if (awaitBlock.value) {
        str.overwrite(thenStart, awaitBlock.value.start, '__sveltets_1_awaitThen(_$$p, (');
        str.overwrite(awaitBlock.value.end, thenEnd, ') => {');
        extractConstTags(awaitBlock.then.children).forEach((insertion) => {
            insertion(thenEnd, str);
        });
        str.appendRight(thenEnd, `${ifScope.addPossibleIfCondition()}<>`);
    } else {
        const awaitThenFn = '__sveltets_1_awaitThen(_$$p, () => {';
        if (thenStart === thenEnd) {
            str.appendLeft(thenStart, awaitThenFn);
        } else {
            str.overwrite(thenStart, thenEnd, awaitThenFn);
        }
        extractConstTags(awaitBlock.then.children).forEach((insertion) => {
            insertion(thenEnd, str);
        });
        str.appendRight(thenEnd, `${ifScope.addPossibleIfCondition()}<>`);
    }
}

export function handleAwaitCatch(
    awaitBlock: BaseNode,
    htmlx: string,
    str: MagicString,
    ifScope: IfScope
): void {
    if (awaitBlock.catch.skip) {
        return;
    }

    if (awaitBlock.pending.skip && awaitBlock.then.skip) {
        if (awaitBlock.error) {
            // {#await ... catch ...}
            const catchBegin = htmlx.indexOf('}', awaitBlock.error.end) + 1;
            str.overwrite(
                awaitBlock.expression.end,
                awaitBlock.error.start,
                '); __sveltets_1_awaitThen(_$$p, () => {}, ('
            );
            str.overwrite(awaitBlock.error.end, catchBegin, ') => {');
            extractConstTags(awaitBlock.catch.children).forEach((insertion) => {
                insertion(catchBegin, str);
            });
            str.appendRight(catchBegin, '<>');
        } else {
            // {#await ... catch}
            const catchBegin = htmlx.indexOf('}', awaitBlock.expression.end) + 1;
            str.overwrite(
                awaitBlock.expression.end,
                catchBegin,
                '); __sveltets_1_awaitThen(_$$p, () => {}, () => {'
            );
            extractConstTags(awaitBlock.catch.children).forEach((insertion) => {
                insertion(catchBegin, str);
            });
            str.appendRight(catchBegin, '<>');
        }
    } else {
        //{:catch error} ->
        //</>}, (error) => {<>

        //catch block includes the {:catch}
        const catchStart = awaitBlock.catch.start;
        const catchSymbolEnd = htmlx.indexOf(':catch', catchStart) + ':catch'.length;

        const errorStart = awaitBlock.error ? awaitBlock.error.start : catchSymbolEnd;
        const errorEnd = awaitBlock.error ? awaitBlock.error.end : errorStart;
        const catchEnd = htmlx.indexOf('}', errorEnd) + 1;
        str.overwrite(catchStart, errorStart, '</>}, (');
        str.overwrite(errorEnd, catchEnd, ') => {');
        extractConstTags(awaitBlock.catch.children).forEach((insertion) => {
            insertion(catchEnd, str);
        });
        str.appendRight(catchEnd, `${ifScope.addPossibleIfCondition()}<>`);
    }
}
