import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * Removes comment
 */
export function handleComment(str: MagicString, node: BaseNode): void {
    str.overwrite(node.start, node.end, '', { contentOnly: true });
}
