import MagicString from 'magic-string';
import { IfScope } from './if-scope';
import { BaseNode } from '../../interfaces';

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

    if (ifBlock.elseif) {
        // {:else if expr}  ->  : (expr) ? <>
        const elseIfStart = htmlx.lastIndexOf('{', ifBlock.expression.start);
        const elseIfConditionEnd = htmlx.indexOf('}', ifBlock.expression.end) + 1;
        str.overwrite(elseIfStart, ifBlock.expression.start, '</> : (', { contentOnly: true });
        str.overwrite(ifBlock.expression.end, elseIfConditionEnd, ') ? <>');

        ifScope.addElseIf(ifBlock.expression, str);

        if (!ifBlock.else) {
            str.appendLeft(endIf, '</> : <>');
        }
        return;
    }

    // {#if expr}  ->  {(expr) ? <>
    str.overwrite(ifBlock.start, ifBlock.expression.start, '{(', { contentOnly: true });
    const end = htmlx.indexOf('}', ifBlock.expression.end);
    str.overwrite(ifBlock.expression.end, end + 1, ') ? <>', { contentOnly: true });

    ifScope.addNestedIf(ifBlock.expression, str);

    if (ifBlock.else) {
        // {/if}  ->  </> }
        str.overwrite(endIf, ifBlock.end, '</> }', { contentOnly: true });
    } else {
        // {/if}  ->  </> : <></>}
        str.overwrite(endIf, ifBlock.end, '</> : <></>}', { contentOnly: true });
    }
}

/**
 * {:else}   --->   </> : <>
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
    str.overwrite(elseStart, elseEnd + 1, '</> : <>');

    ifScope.addElse();
}
