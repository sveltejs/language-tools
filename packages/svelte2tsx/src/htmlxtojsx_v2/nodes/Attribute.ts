import MagicString from 'magic-string';
import svgAttributes from '../svgattributes';
import { rangeWithTrailingPropertyAccess, TransformationArray } from '../utils/node-utils';
import { Attribute, BaseNode } from '../../interfaces';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * List taken from `elements.d.ts` in Svelte core by searching for all attributes of type `number | undefined | null`;
 */
const numberOnlyAttributes = new Set([
    'aria-colcount',
    'aria-colindex',
    'aria-colspan',
    'aria-level',
    'aria-posinset',
    'aria-rowcount',
    'aria-rowindex',
    'aria-rowspan',
    'aria-setsize',
    'aria-valuemax',
    'aria-valuemin',
    'aria-valuenow',
    'results',
    'span',
    'marginheight',
    'marginwidth',
    'maxlength',
    'minlength',
    'currenttime',
    'defaultplaybackrate',
    'volume',
    'high',
    'low',
    'optimum',
    'start',
    'size',
    'border',
    'cols',
    'rows',
    'colspan',
    'rowspan',
    'tabindex'
]);

/**
 * Handle various kinds of attributes and make them conform to being valid in context of a object definition
 * - {x}   --->    x
 * - x="{..}"   --->    x:..
 * - lowercase DOM attributes
 * - multi-value handling
 */
export function handleAttribute(
    str: MagicString,
    attr: Attribute,
    parent: BaseNode,
    preserveCase: boolean,
    svelte5Plus: boolean,
    element: Element | InlineComponent
): void {
    if (
        parent.name === '!DOCTYPE' ||
        ['Style', 'Script'].includes(parent.type) ||
        (attr.name === 'name' && parent.type === 'Slot')
    ) {
        // - <!DOCTYPE html> is already removed by now from MagicString
        // - Don't handle script / style tag attributes (context or lang for example)
        // - name=".." of <slot> tag is already handled in Element
        return;
    }

    if (
        attr.name === 'slot' &&
        attributeValueIsOfType(attr.value, 'Text') &&
        element.parent instanceof InlineComponent
    ) {
        // - slot=".." in context of slots with let:xx is handled differently
        element.addSlotName([[attr.value[0].start, attr.value[0].end]]);
        return;
    }

    const addAttribute =
        element instanceof Element
            ? (name: TransformationArray, value?: TransformationArray) => {
                  if (attr.name.startsWith('data-') && !attr.name.startsWith('data-sveltekit-')) {
                      // any attribute prefixed with data- is valid, but we can't
                      // type that statically, so we need this workaround
                      name.unshift('...__sveltets_2_empty({');
                      if (!value) {
                          value = ['__sveltets_2_any()'];
                      }
                      value.push('})');
                  }
                  element.addAttribute(name, value);
              }
            : (name: TransformationArray, value?: TransformationArray) => {
                  if (attr.name.startsWith('--')) {
                      // CSS custom properties are not part of the props
                      // definition, so wrap them to not get "--xx is invalid prop" errors
                      name.unshift('...__sveltets_2_cssProp({');
                      if (!value) {
                          value = ['""'];
                      }
                      value.push('})');
                  }
                  element.addProp(name, value);
              };

    /**
     * lowercase the attribute name to make it adhere to our intrinsic elements definition
     */
    const transformAttributeCase = (name: string) => {
        if (
            !preserveCase &&
            !svgAttributes.find((x) => x == name) &&
            !(element instanceof Element && element.tagName.includes('-')) &&
            !(svelte5Plus && name.startsWith('on'))
        ) {
            return name.toLowerCase();
        } else {
            return name;
        }
    };

    // Handle attribute name

    const attributeName: TransformationArray = [];

    if (attributeValueIsOfType(attr.value, 'AttributeShorthand')) {
        // For the attribute shorthand, the name will be the mapped part
        addAttribute([[attr.value[0].start, attr.value[0].end]]);
        return;
    } else {
        let name =
            element instanceof Element && parent.type === 'Element'
                ? transformAttributeCase(attr.name)
                : attr.name;
        // surround with quotes because dashes or other invalid property characters could be part of the name
        // Overwrite first char with "+char because TS will squiggle the whole "prop" including quotes when something is wrong
        if (name !== attr.name) {
            name = '"' + name;
            str.overwrite(attr.start, attr.start + attr.name.length, name);
        } else {
            str.overwrite(attr.start, attr.start + 1, '"' + str.original.charAt(attr.start), {
                contentOnly: true
            });
        }
        attributeName.push([attr.start, attr.start + attr.name.length], '"');
    }

    // Handle attribute value

    const attributeValue: TransformationArray = [];

    if (attr.value === true) {
        attributeValue.push('true');
        addAttribute(attributeName, attributeValue);
        return;
    }
    if (attr.value.length == 0) {
        // shouldn't happen
        addAttribute(attributeName, ['""']);
        return;
    }
    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        if (attrVal.type == 'Text') {
            // Handle the attr="" special case with a transformation that allows mapping of the position
            if (attrVal.start === attrVal.end) {
                addAttribute(attributeName, [[attrVal.start - 1, attrVal.end + 1]]);
                return;
            }

            const lastCharIndex = attrVal.end - 1;
            const hasBrackets =
                str.original[lastCharIndex] === '}' ||
                ((str.original[lastCharIndex] === '"' || str.original[lastCharIndex] === "'") &&
                    str.original[lastCharIndex - 1] === '}');

            const needsNumberConversion =
                !hasBrackets &&
                parent.type === 'Element' &&
                numberOnlyAttributes.has(attr.name.toLowerCase()) &&
                !isNaN(attrVal.data);
            const includesTemplateLiteralQuote = attrVal.data.includes('`');
            const quote = !includesTemplateLiteralQuote
                ? '`'
                : ['"', "'"].includes(str.original[attrVal.start - 1])
                  ? str.original[attrVal.start - 1]
                  : '"';

            if (!needsNumberConversion) {
                attributeValue.push(quote);
            }
            if (includesTemplateLiteralQuote && attrVal.data.split('\n').length > 1) {
                // Multiline attribute value text which can't be wrapped in a template literal
                // -> ensure it's still a valid transformation by transforming the actual line break
                str.overwrite(attrVal.start, attrVal.end, attrVal.data.split('\n').join('\\n'), {
                    contentOnly: true
                });
            }
            attributeValue.push([attrVal.start, attrVal.end]);
            if (!needsNumberConversion) {
                attributeValue.push(quote);
            }

            addAttribute(attributeName, attributeValue);
        } else if (attrVal.type == 'MustacheTag') {
            attributeValue.push(rangeWithTrailingPropertyAccess(str.original, attrVal.expression));
            addAttribute(attributeName, attributeValue);
        }
        return;
    }
    // We have multiple attribute values, so we build a template string out of them.
    for (const n of attr.value) {
        if (n.type === 'MustacheTag') {
            str.appendRight(n.start, '$');
        }
    }
    attributeValue.push('`', [attr.value[0].start, attr.value[attr.value.length - 1].end], '`');
    addAttribute(attributeName, attributeValue);
}

function attributeValueIsOfType(value: true | BaseNode[], type: string): value is [BaseNode] {
    return value !== true && value.length == 1 && value[0].type == type;
}
