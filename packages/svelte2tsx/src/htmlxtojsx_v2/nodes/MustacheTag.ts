import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * Handle mustache tags that are not part of attributes
 * {a}  -->  a;
 */
export function handleMustacheTag(str: MagicString, node: BaseNode, parent: BaseNode) {
    if (parent.type === 'Attribute') {
        // handles inside Attribute.ts
        return;
    }
    str.overwrite(node.start, node.start + 1, '', { contentOnly: true });
    str.overwrite(node.end - 1, node.end, ';', { contentOnly: true });
}
