import MagicString from 'magic-string';
// @ts-ignore
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

    let replacement = node.data.replace(/\S/g, '');
    if (!replacement && node.data.length) {
        // minimum of 1 whitespace which ensure hover or other things don't give weird results
        // where for example you hover over a text and get a hover info about the containing tag.
        replacement = ' ';
    }
    str.overwrite(node.start, node.end, replacement, {
        contentOnly: true
    });
}
