import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * Transform each block into something JSX can understand.
 */
export function handleEach(htmlx: string, str: MagicString, eachBlock: Node): void {
    // {#each items as item,i (key)} ->
    // {__sveltets_each(items, (item,i) => (key) && <>
    str.overwrite(eachBlock.start, eachBlock.expression.start, '{__sveltets_each(');
    str.overwrite(eachBlock.expression.end, eachBlock.context.start, ', (');

    // {#each true, items as item}
    if (eachBlock.expression.type === 'SequenceExpression') {
        str.appendRight(eachBlock.expression.start, '(');
        str.appendLeft(eachBlock.expression.end, ')');
    }

    let contextEnd = eachBlock.context.end;
    if (eachBlock.index) {
        const idxLoc = htmlx.indexOf(eachBlock.index, contextEnd);
        contextEnd = idxLoc + eachBlock.index.length;
    }
    str.prependLeft(contextEnd, ') =>');
    if (eachBlock.key) {
        const endEachStart = htmlx.indexOf('}', eachBlock.key.end);
        str.overwrite(endEachStart, endEachStart + 1, ' && <>');
    } else {
        const endEachStart = htmlx.indexOf('}', contextEnd);
        str.overwrite(endEachStart, endEachStart + 1, ' <>');
    }
    const endEach = htmlx.lastIndexOf('{', eachBlock.end - 1);
    // {/each} -> </>)} or {:else} -> </>)}
    if (eachBlock.else) {
        const elseEnd = htmlx.lastIndexOf('}', eachBlock.else.start);
        const elseStart = htmlx.lastIndexOf('{', elseEnd);
        str.overwrite(elseStart, elseEnd + 1, '</>)}');
        str.remove(endEach, eachBlock.end);
    } else {
        str.overwrite(endEach, eachBlock.end, '</>)}');
    }
}
