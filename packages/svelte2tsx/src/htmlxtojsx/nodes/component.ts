import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { getSlotName } from '../../utils/svelteAst';
import { handleSlot } from './slot';
import { IfScope } from './if-scope';
import TemplateScope from '../../svelte2tsx/nodes/TemplateScope';

/**
 * Handle `<svelte:self>` and slot-specific transformations.
 */
export function handleComponent(
    htmlx: string,
    str: MagicString,
    el: Node,
    parent: Node,
    ifScope: IfScope,
    templateScope: TemplateScope
): void {
    //we need to remove : if it is a svelte component
    if (el.name.startsWith('svelte:')) {
        const colon = htmlx.indexOf(':', el.start);
        str.remove(colon, colon + 1);

        const closeTag = htmlx.lastIndexOf('/' + el.name, el.end);
        if (closeTag > el.start) {
            const colon = htmlx.indexOf(':', closeTag);
            str.remove(colon, colon + 1);
        }
    }

    // Handle possible slot
    const slotName = getSlotName(el) || 'default';
    handleSlot(
        htmlx,
        str,
        el,
        slotName === 'default' ? el : parent,
        slotName,
        ifScope,
        templateScope
    );
}
