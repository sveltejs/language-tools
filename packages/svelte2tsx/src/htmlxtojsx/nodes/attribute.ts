import MagicString from 'magic-string';
import svgAttributes from '../svgattributes';
import { isQuote } from '../utils/node-utils';
import { Attribute, BaseNode } from '../../interfaces';

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

/**
 * Handle various kinds of attributes and make them conform to JSX.
 * - {x}   --->    x={x}
 * - x="{..}"   --->    x={..}
 * - lowercase DOM attributes
 * - multi-value handling
 */
export function handleAttribute(
    htmlx: string,
    str: MagicString,
    attr: Attribute,
    parent: BaseNode,
    preserveCase: boolean
): void {
    const shouldApplySlotCheck = parent.type === 'Slot' && attr.name !== 'name';
    const slotName = shouldApplySlotCheck
        ? parent.attributes?.find((a: BaseNode) => a.name === 'name')?.value[0]?.data || 'default'
        : undefined;
    const ensureSlotStr = `__sveltets_ensureSlot("${slotName}","${attr.name}",`;
    let transformedFromDirectiveOrNamespace = false;

    const transformAttributeCase = (name: string) => {
        if (!preserveCase && !svgAttributes.find((x) => x == name)) {
            return name.toLowerCase();
        } else {
            return name;
        }
    };

    //if we are on an "element" we are case insensitive, lowercase to match our JSX
    if (parent.type == 'Element') {
        const sapperLinkActions = ['sapper:prefetch', 'sapper:noscroll'];
        const sveltekitLinkActions = ['sveltekit:prefetch', 'sveltekit:noscroll'];
        // skip Attribute shorthand, that is handled below
        if (
            (attr.value !== true &&
                !(
                    attr.value.length &&
                    attr.value.length == 1 &&
                    attr.value[0].type == 'AttributeShorthand'
                )) ||
            sapperLinkActions.includes(attr.name) ||
            sveltekitLinkActions.includes(attr.name)
        ) {
            let name = transformAttributeCase(attr.name);

            //strip ":" from out attribute name and uppercase the next letter to convert to jsx attribute
            const colonIndex = name.indexOf(':');
            if (colonIndex >= 0) {
                const parts = name.split(':');
                name = parts[0] + parts[1][0].toUpperCase() + parts[1].substring(1);
            }

            str.overwrite(attr.start, attr.start + attr.name.length, name);

            transformedFromDirectiveOrNamespace = true;
        }
    }

    // Custom CSS property
    if (parent.type === 'InlineComponent' && attr.name.startsWith('--') && attr.value !== true) {
        str.prependRight(attr.start, '{...__sveltets_1_cssProp({"');
        buildTemplateString(attr, str, htmlx, '": `', '`})}');
        return;
    }

    //we are a bare attribute
    if (attr.value === true) {
        if (
            parent.type === 'Element' &&
            !transformedFromDirectiveOrNamespace &&
            parent.name !== '!DOCTYPE'
        ) {
            str.overwrite(attr.start, attr.end, transformAttributeCase(attr.name));
        }
        return;
    }

    if (attr.value.length == 0) return; //wut?
    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        if (attr.name == 'slot') {
            str.remove(attr.start, attr.end);
            return;
        }

        if (attrVal.type == 'AttributeShorthand') {
            let attrName = attrVal.expression.name;
            if (parent.type == 'Element') {
                attrName = transformAttributeCase(attrName);
            }

            str.appendRight(attr.start, `${attrName}=`);
            if (shouldApplySlotCheck) {
                str.prependRight(attr.start + 1, ensureSlotStr);
                str.prependLeft(attr.end - 1, ')');
            }
            return;
        }

        const equals = htmlx.lastIndexOf('=', attrVal.start);

        const sanitizedName = sanitizeLeadingChars(attr.name);
        if (sanitizedName !== attr.name) {
            str.overwrite(attr.start, equals, sanitizedName);
        }

        if (attrVal.type == 'Text') {
            const endsWithQuote =
                htmlx.lastIndexOf('"', attrVal.end) === attrVal.end - 1 ||
                htmlx.lastIndexOf("'", attrVal.end) === attrVal.end - 1;
            const needsQuotes = attrVal.end == attr.end && !endsWithQuote;

            const hasBrackets =
                htmlx.lastIndexOf('}', attrVal.end) === attrVal.end - 1 ||
                htmlx.lastIndexOf('}"', attrVal.end) === attrVal.end - 1 ||
                htmlx.lastIndexOf("}'", attrVal.end) === attrVal.end - 1;
            const needsNumberConversion =
                !hasBrackets &&
                parent.type === 'Element' &&
                numberOnlyAttributes.has(attr.name.toLowerCase()) &&
                !isNaN(attrVal.data);

            if (needsNumberConversion) {
                const begin = '{' + (shouldApplySlotCheck ? ensureSlotStr : '');
                const end = shouldApplySlotCheck ? ')}' : '}';
                if (needsQuotes) {
                    str.prependRight(equals + 1, begin);
                    str.appendLeft(attr.end, end);
                } else {
                    str.overwrite(equals + 1, equals + 2, begin);
                    str.overwrite(attr.end - 1, attr.end, end);
                }
            } else if (needsQuotes) {
                const begin = shouldApplySlotCheck ? `{${ensureSlotStr}"` : '"';
                const end = shouldApplySlotCheck ? '")}' : '"';
                str.prependRight(equals + 1, begin);
                str.appendLeft(attr.end, end);
            } else if (shouldApplySlotCheck) {
                str.prependRight(equals + 1, `{${ensureSlotStr}`);
                str.appendLeft(attr.end, ')}');
            }
            return;
        }

        if (attrVal.type == 'MustacheTag') {
            const isInQuotes = attrVal.end != attr.end;
            //if the end doesn't line up, we are wrapped in quotes
            if (isInQuotes) {
                str.remove(attrVal.start - 1, attrVal.start);
                str.remove(attr.end - 1, attr.end);
            }
            if (shouldApplySlotCheck) {
                str.prependRight(attrVal.start + 1, ensureSlotStr);
                str.appendLeft(attr.end - (isInQuotes ? 2 : 1), ')');
            }
            return;
        }
        return;
    }

    // We have multiple attribute values, so we build a template string out of them.
    buildTemplateString(
        attr,
        str,
        htmlx,
        shouldApplySlotCheck ? `={${ensureSlotStr}\`` : '={`',
        shouldApplySlotCheck ? '`)}' : '`}'
    );
}

function buildTemplateString(
    attr: Attribute,
    str: MagicString,
    htmlx: string,
    leadingOverride: string,
    trailingOverride: string
) {
    const equals = htmlx.lastIndexOf('=', attr.value[0].start);
    str.overwrite(equals, attr.value[0].start, leadingOverride);

    for (const n of attr.value as BaseNode[]) {
        if (n.type == 'MustacheTag') {
            str.appendRight(n.start, '$');
        }
    }

    if (isQuote(htmlx[attr.end - 1])) {
        str.overwrite(attr.end - 1, attr.end, trailingOverride);
    } else {
        str.appendLeft(attr.end, trailingOverride);
    }
}

function sanitizeLeadingChars(attrName: string): string {
    let sanitizedName = '';
    for (let i = 0; i < attrName.length; i++) {
        if (/[A-Za-z$_]/.test(attrName[i])) {
            sanitizedName += attrName.substr(i);
            return sanitizedName;
        } else {
            sanitizedName += '_';
        }
    }
    return sanitizedName;
}
