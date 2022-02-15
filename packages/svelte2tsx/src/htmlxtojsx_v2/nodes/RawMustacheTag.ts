import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { withTrailingPropertyAccess } from '../utils/node-utils';

/**
 * {@html ...}   --->   ...;
 */
export function handleRawHtml(str: MagicString, node: BaseNode): void {
    str.overwrite(node.start, node.expression.start, ' ');
    str.overwrite(withTrailingPropertyAccess(str.original, node.expression.end), node.end, ';');
}
