import MagicString from 'magic-string';
import {
    beforeStart,
    getInstanceType,
    getInstanceTypeForDefaultSlot,
    PropsShadowedByLet
} from '../utils/node-utils';
import { IfScope } from './if-scope';
import { TemplateScope } from '../nodes/template-scope';
import { BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { extractConstTags } from './const-tag';

const shadowedPropsSymbol = Symbol('shadowedProps');

interface ComponentNode extends BaseNode {
    // Not pretty, but it works, and because it's a symbol, estree-walker will ignore it
    [shadowedPropsSymbol]?: PropsShadowedByLet[];
}

/**
 * Transforms the usage of a slot (slot="xxx")
 * - transforms let:xx, {@const xx}
 */
export function handleSlot(
    htmlx: string,
    str: MagicString,
    slotEl: BaseNode,
    component: ComponentNode,
    slotName: string,
    ifScope: IfScope,
    templateScope: TemplateScope
): void {
    //collect "let" definitions
    const slotElIsComponent = slotEl === component;
    let hasMovedLet = false;

    let slotDefInsertionPoint: number;
    // lazily calculate insertion point only when needed
    const calculateSlotDefInsertionPoint = () => {
        slotDefInsertionPoint =
            slotDefInsertionPoint ||
            (slotElIsComponent
                ? htmlx.lastIndexOf('>', slotEl.children[0].start) + 1
                : slotEl.start);
    };

    for (const attr of slotEl.attributes) {
        if (attr.type != 'Let') {
            continue;
        }

        if (slotElIsComponent && slotEl.children.length == 0) {
            //no children anyway, just wipe out the attribute
            str.remove(attr.start, attr.end);
            continue;
        }

        calculateSlotDefInsertionPoint();
        str.move(attr.start, attr.end, slotDefInsertionPoint);

        //remove let:
        str.remove(attr.start, attr.start + 'let:'.length);
        if (hasMovedLet) {
            str.appendRight(attr.start + 'let:'.length, ', ');
        }

        templateScope.inits.add(attr.expression?.name || attr.name);
        hasMovedLet = true;
        if (attr.expression) {
            //overwrite the = as a :
            const equalSign = htmlx.lastIndexOf('=', attr.expression.start);
            const curly = htmlx.lastIndexOf('{', beforeStart(attr.expression.start));
            str.overwrite(equalSign, curly + 1, ':');
            str.remove(attr.expression.end, attr.end);
        }
    }
    const hasConstTag = slotEl.children.some((child) => child.type === 'ConstTag');
    if (!hasMovedLet && !hasConstTag) {
        return;
    }
    calculateSlotDefInsertionPoint();

    const { singleSlotDef, constRedeclares } = getSingleSlotDefAndConstsRedeclaration(
        component,
        slotName,
        str.original,
        ifScope,
        slotElIsComponent
    );
    const prefix = constRedeclares ? `() => {${constRedeclares}` : '';
    str.appendLeft(slotDefInsertionPoint, `{${prefix}() => { `);
    if (hasMovedLet) {
        str.appendLeft(slotDefInsertionPoint, 'let {');
        str.appendRight(slotDefInsertionPoint, `} = ${singleSlotDef};`);
    }

    if (hasConstTag) {
        // unable to move multiple codes to the same place while insert code in between
        // NOTE: cheat by move to `slotDefInsertionPoint + 1` position
        // then copy the character in str[slotDefInsertionPoint...slotDefInsertionPoint + 1] to the back
        // and comment out the original str[slotDefInsertionPoint...slotDefInsertionPoint + 1]
        str.appendRight(slotDefInsertionPoint, '/*');
        extractConstTags(slotEl.children).forEach((insertion) => {
            insertion(slotDefInsertionPoint + 1, str);
        });
        str.appendRight(slotDefInsertionPoint + 1, `${ifScope.addPossibleIfCondition()}<>`);
        str.appendRight(
            slotDefInsertionPoint + 1,
            str.original.slice(slotDefInsertionPoint, slotDefInsertionPoint + 1)
        );
        str.appendLeft(slotDefInsertionPoint + 1, '*/');
    } else {
        str.appendRight(slotDefInsertionPoint, `${ifScope.addPossibleIfCondition()}<>`);
    }

    const closeSlotDefInsertionPoint = slotElIsComponent
        ? htmlx.lastIndexOf('<', slotEl.end - 1)
        : slotEl.end;
    str.appendLeft(closeSlotDefInsertionPoint, `</>}}${constRedeclares ? '}' : ''}`);
}

function getSingleSlotDefAndConstsRedeclaration(
    componentNode: ComponentNode,
    slotName: string,
    originalStr: string,
    ifScope: IfScope,
    findAndRedeclareShadowedProps: boolean
) {
    if (findAndRedeclareShadowedProps) {
        const replacement = 'Ψ';
        const { str, shadowedProps } = getInstanceTypeForDefaultSlot(
            componentNode,
            originalStr,
            replacement
        );
        componentNode[shadowedPropsSymbol] = shadowedProps;
        return {
            singleSlotDef: `${str}.$$slot_def['${slotName}']`,
            constRedeclares: getConstsToRedeclare(ifScope, shadowedProps)
        };
    } else {
        const str = getInstanceType(
            componentNode,
            originalStr,
            componentNode[shadowedPropsSymbol] || []
        );
        return {
            singleSlotDef: `${str}.$$slot_def['${slotName}']`,
            constRedeclares: ifScope.getConstDeclaration()
        };
    }
}

function getConstsToRedeclare(ifScope: IfScope, shadowedProps: PropsShadowedByLet[]) {
    const ifScopeRedeclarations = ifScope.getConstsToRedeclare();
    const letRedeclarations = shadowedProps.map(
        ({ value, replacement }) => `${replacement}=${value}`
    );
    const replacements = [...ifScopeRedeclarations, ...letRedeclarations].join(',');
    return replacements ? surroundWithIgnoreComments(`const ${replacements};`) : '';
}
