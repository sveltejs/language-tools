import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { IfScope } from './if-scope';

/**
 * Transform each block into something JSX can understand.
 */
export function handleEach(
    htmlx: string,
    str: MagicString,
    eachBlock: Node,
    ifScope: IfScope
): void {
    // {#each items as item,i (key)} ->
    // {__sveltets_1_each(items, (item,i) => (key) && (possible if expression &&) <>
    const constRedeclares = ifScope.getConstDeclaration();
    const prefix = constRedeclares ? `{() => {${constRedeclares}() => ` : '';
    str.overwrite(eachBlock.start, eachBlock.expression.start, `${prefix}{__sveltets_1_each(`);
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
        str.overwrite(endEachStart, endEachStart + 1, ` && ${ifScope.addPossibleIfCondition()}<>`);
    } else {
        const endEachStart = htmlx.indexOf('}', contextEnd);
        str.overwrite(endEachStart, endEachStart + 1, ` ${ifScope.addPossibleIfCondition()}<>`);
    }

    const endEach = htmlx.lastIndexOf('{', eachBlock.end - 1);
    const suffix = constRedeclares ? '</>)}}}' : '</>)}';
    // {/each} -> </>)} or {:else} -> </>)}
    if (eachBlock.else) {
        const elseEnd = htmlx.lastIndexOf('}', eachBlock.else.start);
        const elseStart = htmlx.lastIndexOf('{', elseEnd);
        str.overwrite(elseStart, elseEnd + 1, suffix);
        str.remove(endEach, eachBlock.end);
    } else {
        str.overwrite(endEach, eachBlock.end, suffix);
    }
}
