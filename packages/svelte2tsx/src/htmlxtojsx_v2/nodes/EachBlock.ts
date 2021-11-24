import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { transform, TransformationArray } from '../utils/node-utils';

/**
 * Transform #each into a for-of loop
 *
 * Current limitation:
 * `{#each foo as foo}` is valid Svelte code, but the transformation
 * `for(const foo of foo){..}` is invalid ("variable used before declaration").
 * Solving this would involve a separate temporary variable like
 * `{const $$_foo = foo; {for(const foo of $$_foo){..}}}`, which would have problems
 * with mappings for rename, diagnostics etc.
 */
export function handleEach(str: MagicString, eachBlock: BaseNode): void {
    // {#each items as item,i (key)} ->
    // for (const item of __sveltets_2_each(items)) { let i = 0;key;
    const startEnd = str.original.indexOf('}', eachBlock.key?.end || eachBlock.context.end) + 1;
    const transforms: TransformationArray = [
        'for(const ',
        [eachBlock.context.start, eachBlock.context.end],
        ' of (',
        [eachBlock.expression.start, eachBlock.expression.end],
        ')){'
    ];
    if (eachBlock.key) {
        transforms.push([eachBlock.key.start, eachBlock.key.end], ';');
    }
    if (eachBlock.index) {
        const indexStart = str.original.indexOf(eachBlock.index, eachBlock.context.end);
        const indexEnd = indexStart + eachBlock.index.length;
        transforms.push('let ', [indexStart, indexEnd], ' = 1;');
    }
    transform(str, eachBlock.start, startEnd, startEnd, transforms);

    const endEach = str.original.lastIndexOf('{', eachBlock.end - 1);
    // {/each} -> } or {:else} -> }
    if (eachBlock.else) {
        const elseEnd = str.original.lastIndexOf('}', eachBlock.else.start);
        const elseStart = str.original.lastIndexOf('{', elseEnd);
        str.overwrite(elseStart, elseEnd + 1, '}', { contentOnly: true });
        str.remove(endEach, eachBlock.end);
    } else {
        str.overwrite(endEach, eachBlock.end, '}', { contentOnly: true });
    }
}
