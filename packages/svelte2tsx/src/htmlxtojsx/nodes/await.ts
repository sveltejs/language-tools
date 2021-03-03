import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { IfScope } from './if-scope';

/**
 * Transform {#await ...} into something JSX understands
 */
export function handleAwait(
    htmlx: string,
    str: MagicString,
    awaitBlock: Node,
    ifScope: IfScope
): void {
    // {#await somePromise then value} ->
    // {() => {let _$$p = (somePromise);
    const constRedeclares = ifScope.getConstsToRedeclare();
    str.overwrite(
        awaitBlock.start,
        awaitBlock.expression.start,
        `{() => {${constRedeclares}let _$$p = (`
    );

    // then value } | {:then value} | {await ..} .. {/await} ->
    // __sveltets_awaitThen(_$$p, (value) => {(possibleIfCondition && )<>
    let thenStart: number;
    let thenEnd: number;
    if (!awaitBlock.then.skip) {
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
            str.prependLeft(thenStart, '</>; ');
            // add the start tag too
            const awaitEnd = htmlx.indexOf('}', awaitBlock.expression.end);

            // somePromise} -> somePromise);
            str.overwrite(awaitBlock.expression.end, awaitEnd + 1, ');');
            str.appendRight(awaitEnd + 1, ` ${ifScope.addPossibleIfCondition()}<>`);
        } else {
            // {await ... then ...}
            thenStart = htmlx.indexOf('then', awaitBlock.expression.end);
            thenEnd = htmlx.lastIndexOf('}', awaitBlock.then.start) + 1;
            // somePromise then -> somePromise); then
            str.overwrite(awaitBlock.expression.end, thenStart, '); ');
        }
    } else {
        // {await ..} ... ({:catch ..}) {/await} -> no then block, no value, but always a pending block
        thenEnd = awaitBlock.catch.skip
            ? htmlx.lastIndexOf('{', awaitBlock.end)
            : awaitBlock.catch.start;
        thenStart = Math.min(awaitBlock.pending.end + 1, thenEnd);

        const awaitEnd = htmlx.indexOf('}', awaitBlock.expression.end);
        str.overwrite(awaitBlock.expression.end, awaitEnd + 1, ');');
        str.appendRight(awaitEnd + 1, ' <>');
        str.appendLeft(thenEnd, '</>; ');
    }

    if (awaitBlock.value) {
        str.overwrite(thenStart, awaitBlock.value.start, '__sveltets_awaitThen(_$$p, (');
        str.overwrite(awaitBlock.value.end, thenEnd, `) => {${ifScope.addPossibleIfCondition()}<>`);
    } else {
        const awaitThenFn = `__sveltets_awaitThen(_$$p, () => {${ifScope.addPossibleIfCondition()}<>`;
        if (thenStart === thenEnd) {
            str.appendLeft(thenStart, awaitThenFn);
        } else {
            str.overwrite(thenStart, thenEnd, awaitThenFn);
        }
    }

    //{:catch error} ->
    //</>}, (error) => {<>
    if (!awaitBlock.catch.skip) {
        //catch block includes the {:catch}
        const catchStart = awaitBlock.catch.start;
        const catchSymbolEnd = htmlx.indexOf(':catch', catchStart) + ':catch'.length;

        const errorStart = awaitBlock.error ? awaitBlock.error.start : catchSymbolEnd;
        const errorEnd = awaitBlock.error ? awaitBlock.error.end : errorStart;
        const catchEnd = htmlx.indexOf('}', errorEnd) + 1;
        str.overwrite(catchStart, errorStart, '</>}, (');
        str.overwrite(errorEnd, catchEnd, `) => {${ifScope.addPossibleIfCondition()}<>`);
    }
    // {/await} ->
    // <>})}
    const awaitEndStart = htmlx.lastIndexOf('{', awaitBlock.end - 1);
    str.overwrite(awaitEndStart, awaitBlock.end, '</>})}}');
}
