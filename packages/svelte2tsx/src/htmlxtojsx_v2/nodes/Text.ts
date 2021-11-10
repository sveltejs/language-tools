import MagicString from 'magic-string';
import { Text } from 'svelte/types/compiler/interfaces';
import { BaseNode } from '../../interfaces';

/**
 * Handles a text node transformation.
 * Removes everything except whitespace (for better visual output) when it's normal HTML text for example inside an element
 * to not clutter up the output. For attributes it leaves the text as is.
 */
export function handleText(str: MagicString, node: Text, parent: BaseNode): void {
    if (!node.data || parent.type === 'Attribute') {
        return;
    }

    str.overwrite(node.start, node.end, node.data.replace(/\S/g, ''), {
        contentOnly: true
    });
}
