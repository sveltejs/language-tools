import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { transform } from '../utils/node-utils';

/**
 * {@html ...}   --->   ...;
 */
export function handleRawHtml(str: MagicString, node: BaseNode): void {
    transform(str, node.start, node.end, node.end, [
        [node.expression.start, node.expression.end],
        ';'
    ]);
}
