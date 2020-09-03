import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * `<svelte:window>...</svelte:window>`   ---->    `<sveltewindow>...</sveltewindow>`
 * (same for :head, :body, :options)
 */
export function handleSvelteTag(htmlx: string, str: MagicString, node: Node): void {
    const colon = htmlx.indexOf(':', node.start);
    str.remove(colon, colon + 1);

    const closeTag = htmlx.lastIndexOf('/' + node.name, node.end);
    if (closeTag > node.start) {
        const colon = htmlx.indexOf(':', closeTag);
        str.remove(colon, colon + 1);
    }
}
