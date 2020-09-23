import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { getSlotName } from '../../utils/svelteAst';
import { beforeStart } from '../utils/node-utils';
import { getSingleSlotDef } from '../../svelte2tsx/nodes/slot';

/**
 * Handle `<svelte:self>` and slot-specific transformations.
 */
export function handleComponent(htmlx: string, str: MagicString, el: Node): void {
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

    //we only need to do something if there is a let or slot
    handleSlot(htmlx, str, el, el, 'default');

    //walk the direct children looking for slots. We do this here because we need the name of our component for handleSlot
    //we could lean on leave/enter, but I am lazy
    if (!el.children) return;
    for (const child of el.children) {
        const slotName = getSlotName(child);
        if (slotName) {
            handleSlot(htmlx, str, child, el, slotName);
        }
    }
}

function handleSlot(
    htmlx: string,
    str: MagicString,
    slotEl: Node,
    component: Node,
    slotName: string,
): void {
    //collect "let" definitions
    let hasMoved = false;
    let afterTag: number;
    for (const attr of slotEl.attributes) {
        if (attr.type != 'Let') {
            continue;
        }

        if (slotEl.children.length == 0) {
            //no children anyway, just wipe out the attribute
            str.remove(attr.start, attr.end);
            continue;
        }

        afterTag = afterTag || htmlx.lastIndexOf('>', slotEl.children[0].start) + 1;

        str.move(attr.start, attr.end, afterTag);

        //remove let:
        if (hasMoved) {
            str.overwrite(attr.start, attr.start + 'let:'.length, ', ');
        } else {
            str.remove(attr.start, attr.start + 'let:'.length);
        }
        hasMoved = true;
        if (attr.expression) {
            //overwrite the = as a :
            const equalSign = htmlx.lastIndexOf('=', attr.expression.start);
            const curly = htmlx.lastIndexOf('{', beforeStart(attr.expression.start));
            str.overwrite(equalSign, curly + 1, ':');
            str.remove(attr.expression.end, attr.end);
        }
    }
    if (!hasMoved) {
        return;
    }
    str.appendLeft(afterTag, '{() => { let {');
    str.appendRight(afterTag, `} = ${getSingleSlotDef(component, slotName)}` + ';<>');

    const closeTagStart = htmlx.lastIndexOf('<', slotEl.end - 1);
    str.appendLeft(closeTagStart, '</>}}');
}
