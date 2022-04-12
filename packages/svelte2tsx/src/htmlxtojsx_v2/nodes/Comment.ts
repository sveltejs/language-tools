import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * Removes comment altogether as it's unimportant for the output
 */
export function handleComment(str: MagicString, node: BaseNode): void {
    str.overwrite(node.start, node.end, '', { contentOnly: true });
}
