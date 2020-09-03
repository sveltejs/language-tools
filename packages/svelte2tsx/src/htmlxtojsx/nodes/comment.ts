import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * Removes comment
 */
export function handleComment(str: MagicString, node: Node): void {
    str.remove(node.start, node.end);
}
