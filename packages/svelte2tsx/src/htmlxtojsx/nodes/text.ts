import MagicString from 'magic-string';
import { Text } from 'svelte/types/compiler/interfaces';

export function handleText(str: MagicString, node: Text) {
    if (!node.data) {
        return;
    }
    const needsRemoves = ['}', '>'] as const;

    for (const token of needsRemoves) {
        let index = node.data.indexOf(token);
        while (index >= 0) {
            str.remove(index + node.start, index + node.start + 1);
            index = node.data.indexOf(token, index + 1);
        }
    }
}
