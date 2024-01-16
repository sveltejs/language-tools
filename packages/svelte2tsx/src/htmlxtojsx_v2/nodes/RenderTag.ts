import MagicString from 'magic-string';
import { withTrailingPropertyAccess } from '../utils/node-utils';
import { BaseNode } from '../../interfaces';

/**
 * `{@render foo(x)}` --> `;foo(x);`
 */
export function handleRenderTag(str: MagicString, renderTag: BaseNode): void {
    str.overwrite(renderTag.start, renderTag.expression.start, ';__sveltets_2_ensureSnippet(', {
        contentOnly: true
    });

    // argument was present until https://github.com/sveltejs/svelte/pull/9988, remove at some point
    const arg = renderTag.argument || renderTag.arguments?.[renderTag.arguments.length - 1];

    if (arg) {
        str.overwrite(withTrailingPropertyAccess(str.original, arg.end), renderTag.end, '));');
    } else {
        str.overwrite(
            withTrailingPropertyAccess(str.original, renderTag.expression.end),
            renderTag.end,
            '());'
        );
    }
}
