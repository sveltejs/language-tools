import { Node } from 'estree-walker';
import MagicString from 'magic-string';

export function handleText(str: MagicString, node: Node) {
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
