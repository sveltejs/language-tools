import MagicString from 'magic-string';
import { Text } from 'svelte/types/compiler/interfaces';
import { BaseNode } from '../../interfaces';

/**
 * Handles a text node transformation.
 * Removes everything except newlines when it's normal HTML text inside an element
 * to not clutter up the output. For attributes etc it leaves the text as is.
 */
export function handleText(str: MagicString, node: Text, parent: BaseNode): void {
    if (!node.data || !['Fragment', 'Element', 'InlineComponent'].includes(parent.type)) {
        return;
    }

    str.overwrite(node.start, node.end, node.data.includes('\n') ? '\n' : '', {
        contentOnly: true
    });
}
