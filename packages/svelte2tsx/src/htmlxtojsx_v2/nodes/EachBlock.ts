import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { getEnd, transform, TransformationArray } from '../utils/node-utils';

/**
 * Transform #each into a for-of loop
 *
 * Implementation notes:
 * - If code is
 *   `{#each items as items,i (key)}`
 *   then the transformation is
 *   `{ const $$_each = __sveltets_2_ensureArray(items); for (const items of $$_each) { let i = 0;key;`.
 *   Transform it this way because `{#each items as items}` is valid Svelte code, but the transformation
 *   `for(const items of items){..}` is invalid ("variable used before declaration"). Don't do the transformation
 *   like this everytime because `$$_each` could turn up in the auto completion.
 *
 * - The `ensureArray` method checks that only `ArrayLike` objects are passed to `#each`.
 *   `for (const ..)` wouldn't error in this case because it accepts any kind of iterable.
 *
 * - `{#each true, items as item}` is valid, we need to add braces around that expression, else
 *   `ensureArray` will error that there are more args than expected
 */
export function handleEach(str: MagicString, eachBlock: BaseNode): void {
    const startEnd = str.original.indexOf('}', eachBlock.key?.end || eachBlock.context.end) + 1;
    let transforms: TransformationArray;
    // {#each true, [1,2]} is valid but for (const x of true, [1,2]) is not if not wrapped with braces
    const containsComma = str.original
        .substring(eachBlock.expression.start, eachBlock.expression.end)
        .includes(',');
    const expressionEnd = getEnd(eachBlock.expression);
    const contextEnd = getEnd(eachBlock.context);
    const arrayAndItemVarTheSame =
        str.original.substring(eachBlock.expression.start, expressionEnd) ===
        str.original.substring(eachBlock.context.start, contextEnd);
    if (arrayAndItemVarTheSame) {
        transforms = [
            `{ const $$_each = __sveltets_2_ensureArray(${containsComma ? '(' : ''}`,
            [eachBlock.expression.start, eachBlock.expression.end],
            `${containsComma ? ')' : ''}); for(let `,
            [eachBlock.context.start, contextEnd],
            ' of $$_each){'
        ];
    } else {
        transforms = [
            'for(let ',
            [eachBlock.context.start, contextEnd],
            ` of __sveltets_2_ensureArray(${containsComma ? '(' : ''}`,
            [eachBlock.expression.start, eachBlock.expression.end],
            `${containsComma ? ')' : ''})){`
        ];
    }
    if (eachBlock.index) {
        const indexStart = str.original.indexOf(eachBlock.index, eachBlock.context.end);
        const indexEnd = indexStart + eachBlock.index.length;
        transforms.push('let ', [indexStart, indexEnd], ' = 1;');
    }
    if (eachBlock.key) {
        transforms.push([eachBlock.key.start, eachBlock.key.end], ';');
    }
    transform(str, eachBlock.start, startEnd, startEnd, transforms);

    const endEach = str.original.lastIndexOf('{', eachBlock.end - 1);
    // {/each} -> } or {:else} -> }
    if (eachBlock.else) {
        const elseEnd = str.original.lastIndexOf('}', eachBlock.else.start);
        const elseStart = str.original.lastIndexOf('{', elseEnd);
        str.overwrite(elseStart, elseEnd + 1, '}' + (arrayAndItemVarTheSame ? '}' : ''), {
            contentOnly: true
        });
        str.remove(endEach, eachBlock.end);
    } else {
        str.overwrite(endEach, eachBlock.end, '}' + (arrayAndItemVarTheSame ? '}' : ''), {
            contentOnly: true
        });
    }
}
