export interface SvelteNode {
    start: number;
    end: number;
    type: string;
    parent?: SvelteNode;
}

type HTMLLike = 'Element' | 'InlineComponent' | 'Body' | 'Window';

function matchesOnly(type: string | undefined, only?: 'Element' | 'InlineComponent'): boolean {
    return (
        !only ||
        // We hide the detail that body/window are also like elements in the context of this usage
        (only === 'Element' && ['Element', 'Body', 'Window'].includes(type as HTMLLike)) ||
        (only === 'InlineComponent' && type === 'InlineComponent')
    );
}

/**
 * Returns true if given node is a component or html element, or if the offset is at the end of the node
 * and its parent is a component or html element.
 */
export function isInTag(node: SvelteNode | null | undefined, offset: number): boolean {
    return (
        node?.type === 'InlineComponent' ||
        node?.type === 'Element' ||
        (node?.end === offset &&
            (node?.parent?.type === 'InlineComponent' || node?.parent?.type === 'Element'))
    );
}

/**
 * Returns when given node represents an HTML Attribute.
 * Example: The `class` in `<div class=".."`.
 * Note: This method returns `false` for shorthands like `<div {foo}`.
 */
export function isAttributeName(
    node: SvelteNode | null | undefined,
    only?: 'Element' | 'InlineComponent'
): boolean {
    return !!node && node.type === 'Attribute' && matchesOnly(node.parent?.type, only);
}

/**
 * Returns when given node represents an HTML Attribute shorthand or is inside one.
 * Example: The `{foo}` in `<div {foo}`
 */
export function isAttributeShorthand(
    node: SvelteNode | null | undefined,
    only?: 'Element' | 'InlineComponent'
): boolean {
    if (!node) {
        return false;
    }
    do {
        // We could get the expression, or the shorthand, or the attribute
        // Be pragmatic and just go upwards until we can't anymore
        if (isAttributeName(node, only)) {
            return true;
        }
        node = node.parent!;
    } while (node);
    return false;
}

/**
 * Returns when given node represents an HTML Attribute shorthand or is inside one.
 * Example: The `on:click={foo}` in `<div on:click={foo}`
 */
export function isEventHandler(
    node: SvelteNode | null | undefined,
    only?: 'Element' | 'InlineComponent'
) {
    return !!node && node.type === 'EventHandler' && matchesOnly(node.parent?.type, only);
}
