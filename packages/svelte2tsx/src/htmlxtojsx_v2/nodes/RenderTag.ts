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
    if (renderTag.argument) {
        str.overwrite(
            withTrailingPropertyAccess(str.original, renderTag.argument.end),
            renderTag.end,
            '));'
        );
    } else {
        str.overwrite(
            withTrailingPropertyAccess(str.original, renderTag.expression.end),
            renderTag.end,
            '());'
        );
    }
}
