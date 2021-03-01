import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { beforeStart } from '../utils/node-utils';
import { getSingleSlotDef } from '../../svelte2tsx/nodes/slot';
import { IfScope } from './if-scope';
import TemplateScope from '../../svelte2tsx/nodes/TemplateScope';

/**
 * Handle `<svelte:self>` and slot-specific transformations.
 */
export function handleComponent(
    htmlx: string,
    str: MagicString,
    el: Node,
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

    //we only need to do something if there is a let or slot
    handleSlot(htmlx, str, el, el, 'default', ifScope, templateScope);
}

export function usesLet(node: Node) {
    return node.attributes?.some((attr) => attr.type === 'Let');
}

export function handleSlot(
    htmlx: string,
    str: MagicString,
    slotEl: Node,
    component: Node,
    slotName: string,
    ifScope: IfScope,
    templateScope: TemplateScope
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
        templateScope.add(
            {
                name: attr.expression?.name || attr.name,
                type: 'Identifier'
            },
            slotEl
        );
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
    str.appendLeft(slotDefInsertionPoint, `{${ifScope.addConstsPrefixIfNecessary()}() => { let {`);
    str.appendRight(
        slotDefInsertionPoint,
        `} = ${getSingleSlotDef(component, slotName)}` + `;${ifScope.addPossibleIfCondition()}<>`
    );

    const closeSlotDefInsertionPoint = slotElIsComponent
        ? htmlx.lastIndexOf('<', slotEl.end - 1)
        : slotEl.end;
    str.appendLeft(closeSlotDefInsertionPoint, `</>}}${ifScope.addConstsSuffixIfNecessary()}`);
}
