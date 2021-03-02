import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { beforeStart } from '../utils/node-utils';
import { getSingleSlotDef } from '../../svelte2tsx/nodes/slot';

export function handleSlot(
    htmlx: string,
    str: MagicString,
    slotEl: Node,
    component: Node,
    slotName: string
): void {
    //collect "let" definitions
    const slotElIsComponent = slotEl === component;
    let hasMoved = false;
    let slotDefInsertionPoint: number;
    for (const attr of slotEl.attributes) {
        if (attr.type != 'Let') {
            continue;
        }

        if (slotElIsComponent && slotEl.children.length == 0) {
            //no children anyway, just wipe out the attribute
            str.remove(attr.start, attr.end);
            continue;
        }

        slotDefInsertionPoint =
            slotDefInsertionPoint ||
            (slotElIsComponent
                ? htmlx.lastIndexOf('>', slotEl.children[0].start) + 1
                : slotEl.start);

        str.move(attr.start, attr.end, slotDefInsertionPoint);

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
    str.appendLeft(slotDefInsertionPoint, '{() => { let {');
    str.appendRight(slotDefInsertionPoint, `} = ${getSingleSlotDef(component, slotName)}` + ';<>');

    const closeSlotDefInsertionPoint = slotElIsComponent
        ? htmlx.lastIndexOf('<', slotEl.end - 1)
        : slotEl.end;
    str.appendLeft(closeSlotDefInsertionPoint, '</>}}');
}
