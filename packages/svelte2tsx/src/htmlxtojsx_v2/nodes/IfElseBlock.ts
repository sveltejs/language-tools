import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { isImplicitlyClosedBlock, withTrailingPropertyAccess } from '../utils/node-utils';

/**
 * Transforms #if and :else if to a regular if control block.
 */
export function handleIf(str: MagicString, ifBlock: Node): void {
    if (ifBlock.elseif) {
        // {:else if expr}  -->  } else if(expr) {
        const start = str.original.lastIndexOf('{', ifBlock.expression.start);
        str.overwrite(start, ifBlock.expression.start, '} else if (');
    } else {
        // {#if expr}  -->  if (expr){
        str.overwrite(ifBlock.start, ifBlock.expression.start, 'if(');
    }
    const expressionEnd = withTrailingPropertyAccess(str.original, ifBlock.expression.end);
    const end = str.original.indexOf('}', expressionEnd);
    str.overwrite(expressionEnd, end + 1, '){');

    const endif = str.original.lastIndexOf('{', ifBlock.end - 1);
    if (isImplicitlyClosedBlock(endif, ifBlock)) {
        str.prependLeft(ifBlock.end, '}');
    } else {
        // {/if} -> }
        str.overwrite(endif, ifBlock.end, '}');
    }
}

/**
 * {:else}   --->   } else {
 */
export function handleElse(str: MagicString, elseBlock: Node, parent: Node): void {
    if (parent.type !== 'IfBlock') {
        // This is the else branch of an #each block which is handled elsewhere
        return;
    }
    const elseEnd = str.original.lastIndexOf('}', elseBlock.start);
    const elseword = str.original.lastIndexOf(':else', elseEnd);
    const elseStart = str.original.lastIndexOf('{', elseword);
    str.overwrite(elseStart, elseStart + 1, '}');
    str.overwrite(elseEnd, elseEnd + 1, '{');
    const colon = str.original.indexOf(':', elseword);
    str.remove(colon, colon + 1);
}
