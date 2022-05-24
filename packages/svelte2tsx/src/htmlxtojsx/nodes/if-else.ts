import MagicString from 'magic-string';
import { IfScope } from './if-scope';
import { BaseNode } from '../../interfaces';
import { withTrailingPropertyAccess } from '../utils/node-utils';
import { extractConstTags } from './const-tag';

/**
 * {# if ...}...{/if}   --->   {() => {if(...){<>...</>}}}
 */
export function handleIf(
    htmlx: string,
    str: MagicString,
    ifBlock: BaseNode,
    ifScope: IfScope
): void {
    const endIf = htmlx.lastIndexOf('{', ifBlock.end - 1);
    const constTags = extractConstTags(ifBlock.children);
    const ifConditionEnd = htmlx.indexOf('}', ifBlock.expression.end) + 1;
    const hasConstTags = !!constTags.length;
    const endIIFE = createEndIIFE(hasConstTags);
    const startIIFE = createStartIIFE(hasConstTags);

    if (hasConstTags) {
        // {@const hi = exp} <div>{hi}> -> {(() => { const hi = exp; return <> <div>{hi}<div></> })}

        constTags.forEach((constTag) => {
            constTag(ifConditionEnd, str);
        });

        str.appendRight(ifConditionEnd, 'return <>');

        if (ifBlock.else) {
            // {:else} -> </>})()}</> : <>
            const elseWord = htmlx.lastIndexOf(':else', ifBlock.else.start);
            const elseStart = htmlx.lastIndexOf('{', elseWord);
            str.appendLeft(elseStart, endIIFE);
        }
    }

    if (ifBlock.elseif) {
        // {:else if expr}  ->  : (expr) ? <>
        // {:else if expr}{@const ...}  ->  : (expr) ? <>{(() => {const ...; return <>
        const elseIfStart = htmlx.lastIndexOf('{', ifBlock.expression.start);
        str.overwrite(elseIfStart, ifBlock.expression.start, '</> : (', {
            contentOnly: true
        });
        str.overwrite(
            withTrailingPropertyAccess(str.original, ifBlock.expression.end),
            ifConditionEnd,
            ') ? <>' + startIIFE
        );

        ifScope.addElseIf(ifBlock.expression, str);

        if (!ifBlock.else) {
            str.appendLeft(endIf, endIIFE + '</> : <>');
        }
        return;
    }

    // {#if expr}  ->  {(expr) ? <>
    // {#if expr}{@const ...} ->  {(expr) ? <>{(() => {const ...; return <>
    str.overwrite(ifBlock.start, ifBlock.expression.start, '{(', { contentOnly: true });

    str.overwrite(
        withTrailingPropertyAccess(str.original, ifBlock.expression.end),
        ifConditionEnd,
        ') ? <>' + startIIFE,
        { contentOnly: true }
    );

    ifScope.addNestedIf(ifBlock.expression, str);

    if (ifBlock.else) {
        // {/if}  ->  </> }
        str.overwrite(endIf, ifBlock.end, '</> }', { contentOnly: true });
    } else {
        // {/if}  ->  </> : <></>}
        // {@const ...} -> </>})()}</> : <></>}
        str.overwrite(endIf, ifBlock.end, endIIFE + '</> : <></>}', {
            contentOnly: true
        });
    }
}

function createStartIIFE(hasConstTags: boolean) {
    return hasConstTags ? '{(() => {' : '';
}

function createEndIIFE(hasConstTags: boolean) {
    return hasConstTags ? '</>})()}' : '';
}

/**
 * {:else}   --->   </> : <>
 * {:else} {@const ...} -> </> : <>{(() => { const ...; return<>
 */
export function handleElse(
    htmlx: string,
    str: MagicString,
    elseBlock: BaseNode,
    parent: BaseNode,
    ifScope: IfScope
): void {
    if (
        parent.type !== 'IfBlock' ||
        (elseBlock.children[0]?.type === 'IfBlock' && elseBlock.children[0]?.elseif)
    ) {
        return;
    }

    const elseEnd = htmlx.lastIndexOf('}', elseBlock.start);
    const elseword = htmlx.lastIndexOf(':else', elseEnd);
    const elseStart = htmlx.lastIndexOf('{', elseword);
    const constTags = extractConstTags(elseBlock.children);
    const hasConstTags = !!constTags.length;

    str.overwrite(elseStart, elseEnd + 1, '</> : <>' + createStartIIFE(hasConstTags));

    ifScope.addElse();

    if (!hasConstTags) {
        return;
    }

    constTags.forEach((constTag) => {
        constTag(elseEnd + 1, str);
    });

    str.appendRight(elseEnd + 1, 'return <>');
    str.appendLeft(elseBlock.end, createEndIIFE(true));
}
