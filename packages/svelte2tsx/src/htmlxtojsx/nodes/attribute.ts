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

    // Custom property -> remove completely due to JSX incompatibility
    if (parent.type === 'InlineComponent' && attr.name.startsWith('--')) {
        str.overwrite(attr.start, attr.end, '', { contentOnly: true });
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
                if (needsQuotes) {
                    str.prependRight(equals + 1, '{');
                    str.appendLeft(attr.end, '}');
                } else {
                    str.overwrite(equals + 1, equals + 2, '{');
                    str.overwrite(attr.end - 1, attr.end, '}');
                }
            } else if (needsQuotes) {
                str.prependRight(equals + 1, '"');
                str.appendLeft(attr.end, '"');
            }
            return;
        }

        if (attrVal.type == 'MustacheTag') {
            //if the end doesn't line up, we are wrapped in quotes
            if (attrVal.end != attr.end) {
                str.remove(attrVal.start - 1, attrVal.start);
                str.remove(attr.end - 1, attr.end);
            }
            return;
        }
        return;
    }

    // we have multiple attribute values, so we build a string out of them.
    // technically the user can do something funky like attr="text "{value} or even attr=text{value}
    // so instead of trying to maintain a nice sourcemap with prepends etc, we just overwrite the whole thing

    const equals = htmlx.lastIndexOf('=', attr.value[0].start);
    str.overwrite(equals, attr.value[0].start, '={`');

    for (const n of attr.value) {
        if (n.type == 'MustacheTag') {
            str.appendRight(n.start, '$');
        }
    }

    if (isQuote(htmlx[attr.end - 1])) {
        str.overwrite(attr.end - 1, attr.end, '`}');
    } else {
        str.appendLeft(attr.end, '`}');
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
