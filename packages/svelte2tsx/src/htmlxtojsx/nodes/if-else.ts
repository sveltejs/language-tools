import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * {# if ...}...{/if}   --->   {() => {if(...){<>...</>}}}
 */
export function handleIf(htmlx: string, str: MagicString, ifBlock: Node): void {
    if (ifBlock.elseif) {
        //we are an elseif so our work is easier
        str.appendLeft(ifBlock.expression.start, '(');
        str.appendLeft(ifBlock.expression.end, ')');
        return;
    }
    // {#if expr} ->
    // {() => { if (expr){ <>
    str.overwrite(ifBlock.start, ifBlock.expression.start, '{() => {if (');
    const end = htmlx.indexOf('}', ifBlock.expression.end);
    str.overwrite(ifBlock.expression.end, end + 1, '){<>');

    // {/if} -> </>}}}</>
    const endif = htmlx.lastIndexOf('{', ifBlock.end - 1);
    str.overwrite(endif, ifBlock.end, '</>}}}');
}

/**
 * {:else}   --->   </>} else {<>
 */
export function handleElse(htmlx: string, str: MagicString, elseBlock: Node, parent: Node): void {
    if (parent.type !== 'IfBlock') {
        return;
    }
    const elseEnd = htmlx.lastIndexOf('}', elseBlock.start);
    const elseword = htmlx.lastIndexOf(':else', elseEnd);
    const elseStart = htmlx.lastIndexOf('{', elseword);
    str.overwrite(elseStart, elseStart + 1, '</>}');
    str.overwrite(elseEnd, elseEnd + 1, '{<>');
    const colon = htmlx.indexOf(':', elseword);
    str.remove(colon, colon + 1);
}
