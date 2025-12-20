import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * Handle mustache tags that are not part of attributes
 * {a}  -->  a;
 */
export function handleMustacheTag(str: MagicString, node: BaseNode, parent: BaseNode) {
    if (parent.type === 'Attribute' || parent.type === 'StyleDirective') {
        // handled inside Attribute.ts / StyleDirective.ts
        return;
    }
    const text = str.original.slice(node.start + 1, node.end - 1);
    if (text.trimStart().startsWith('{')) {
        // possibly an object literal, wrapping it in parentheses so it's treated as an expression
        str.overwrite(node.start, node.start + 1, ';(', { contentOnly: true });
        str.overwrite(node.end - 1, node.end, ');', { contentOnly: true });
        return;
    }
    str.overwrite(node.start, node.start + 1, '', { contentOnly: true });
    str.overwrite(node.end - 1, node.end, ';', { contentOnly: true });
}
