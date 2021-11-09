import MagicString from 'magic-string';
import svgAttributes from '../svgattributes';
import { TransformationArray } from '../utils/node-utils';
import { Attribute, BaseNode } from '../../interfaces';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * List taken from `svelte-jsx.d.ts` by searching for all attributes of type number
 */
const numberOnlyAttributes = new Set([
    'cols',
    'colspan',
    'currenttime',
    'defaultplaybackrate',
    'high',
    'low',
    'marginheight',
    'marginwidth',
    'minlength',
    'maxlength',
    'optimum',
    'rows',
    'rowspan',
    'size',
    'span',
    'start',
    'tabindex',
    'results',
    'volume'
]);
const sapperLinkActions = ['sapper:prefetch', 'sapper:noscroll'];
const sveltekitLinkActions = ['sveltekit:prefetch', 'sveltekit:noscroll'];

/**
 * Handle various kinds of attributes and make them conform to being valid in context of a object definition
 * - {x}   --->    x
 * - x="{..}"   --->    x:..
 * - lowercase DOM attributes
 * - multi-value handling
 */
export function handleAttribute(
    htmlx: string,
    str: MagicString,
    attr: Attribute,
    parent: BaseNode,
    preserveCase: boolean,
    element: Element | InlineComponent
): void {
    if (parent.name === '!DOCTYPE') {
        // <!DOCTYPE html> is already removed by now from MagicString
        return;
    }

    const addAttribute =
        element instanceof Element
            ? (name: TransformationArray, value: TransformationArray) =>
                  element.addAttribute(name, value)
            : (name: TransformationArray, value: TransformationArray) =>
                  element.addProp(name, value);

    // TODO if it's a slot, transform to sth like const slot = component.$$slots[name];
    // const shouldApplySlotCheck = parent.type === 'Slot' && attr.name !== 'name';
    // const slotName = shouldApplySlotCheck
    //     ? parent.attributes?.find((a: BaseNode) => a.name === 'name')?.value[0]?.data || 'default'
    //     : undefined;
    // const ensureSlotStr = `__sveltets_ensureSlot("${slotName}","${attr.name}",`;

    /**
     * lowercase the attribute name to make it adhere to our intrinsic elements definition
     */
    const transformAttributeCase = (name: string) => {
        if (!preserveCase && !svgAttributes.find((x) => x == name)) {
            return name.toLowerCase();
        } else {
            return name;
        }
    };

    const isAttributeShorthand =
        attr.value !== true && attr.value.length == 1 && attr.value[0].type == 'AttributeShorthand';

    const attributeName: TransformationArray = [];

    // Handle attribute name

    if (sapperLinkActions.includes(attr.name) || sveltekitLinkActions.includes(attr.name)) {
        //strip ":" from out attribute name and uppercase the next letter to convert to jsx attribute
        const parts = attr.name.split(':');
        const name = parts[0] + parts[1][0].toUpperCase() + parts[1].substring(1);
        str.overwrite(attr.start, attr.start + attr.name.length, name);
        attributeName.push([attr.start, attr.start + attr.name.length]);
    } else {
        let name =
            element instanceof Element && (attr.value === true || isAttributeShorthand)
                ? transformAttributeCase(attr.name)
                : attr.name;
        if (name !== attr.name) {
            str.overwrite(attr.start, attr.start + attr.name.length, name);
        }
        // surround with quotes because dashes or other invalid property characters could be part of the name
        if (isAttributeShorthand) {
            // For the attribute shorthand, the value will be the mapped part
            attributeName.push(`"${name}"`);
        } else {
            attributeName.push('"', [attr.start, attr.start + attr.name.length], '"');
        }
    }
    // Custom CSS property
    // TODO
    // if (parent.type === 'InlineComponent' && attr.name.startsWith('--') && attr.value !== true) {
    //     str.prependRight(attr.start, '{...__sveltets_1_cssProp({"');
    //     buildTemplateString(attr, str, htmlx, '": `', '`})}');
    //     return;
    // }

    // Handle attribute value

    const attributeValue: TransformationArray = [];

    if (attr.value === true) {
        attributeValue.push('true');
        addAttribute(attributeName, attributeValue);
        return;
    }
    if (attr.value.length == 0) {
        // this shouldn't be possible
        return;
    }
    if (isAttributeShorthand) {
        attributeValue.push([attr.value[0].start, attr.value[0].end]);
        addAttribute(attributeName, attributeValue);
        return;
    }
    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        // TODO slot
        // if (attr.name == 'slot') {
        //     str.remove(attr.start, attr.end);
        //     return;
        // }

        if (attrVal.type == 'Text') {
            const hasBrackets =
                htmlx.lastIndexOf('}', attrVal.end) === attrVal.end - 1 ||
                htmlx.lastIndexOf('}"', attrVal.end) === attrVal.end - 1 ||
                htmlx.lastIndexOf("}'", attrVal.end) === attrVal.end - 1;
            const needsNumberConversion =
                !hasBrackets &&
                parent.type === 'Element' &&
                numberOnlyAttributes.has(attr.name.toLowerCase()) &&
                !isNaN(attrVal.data);

            if (!needsNumberConversion) {
                attributeValue.push('"');
            }
            attributeValue.push([attrVal.start, attrVal.end]);
            if (!needsNumberConversion) {
                attributeValue.push('"');
            }

            addAttribute(attributeName, attributeValue);
        } else if (attrVal.type == 'MustacheTag') {
            attributeValue.push([attrVal.expression.start, attrVal.expression.end]);
            addAttribute(attributeName, attributeValue);
            // TODO
            // if (shouldApplySlotCheck) {
            //     str.prependRight(attrVal.start + 1, ensureSlotStr);
            //     str.appendLeft(attr.end - (isInQuotes ? 2 : 1), ')');
            // }
        }
        return;
    }
    // We have multiple attribute values, so we build a template string out of them.
    for (const n of attr.value as BaseNode[]) {
        if (n.type == 'MustacheTag') {
            str.appendRight(n.start, '$');
        }
    }
    attributeValue.push('`', [attr.expression.start, attr.expression.end], '`');
    addAttribute(attributeName, attributeValue);
}
