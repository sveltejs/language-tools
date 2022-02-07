import MagicString from 'magic-string';
import { ConstTag } from '../../interfaces';
import { getNodeRangeIncludingTrailingPropertyAccess, transform } from '../utils/node-utils';

/**
 * `{@const x = y}` --> `const x = y;`
 *
 * The transformation happens directly in-place. This is more strict than the
 * Svelte compiler because the compiler moves all const declarations to the top.
 * This transformation results in `x used before being defined` errors if someone
 * uses a const variable before declaring it, which arguably is more helpful
 * than what the Svelte compiler does.
 */
export function handleConstTag(str: MagicString, constTag: ConstTag): void {
    transform(str, constTag.start, constTag.end, constTag.end, [
        'const ',
        getNodeRangeIncludingTrailingPropertyAccess(str.original, constTag.expression),
        ';'
    ]);
}
