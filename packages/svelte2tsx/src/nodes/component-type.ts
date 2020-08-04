import { Node } from 'estree-walker';

export function getTypeForComponent(node: Node) {
    if (node.name === 'svelte:component' || node.name === 'svelte:self') {
        return '__sveltets_componentType()';
    } else {
        return node.name;
    }
}
