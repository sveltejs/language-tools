import MagicString from 'magic-string';
import svelte from 'svelte/compiler';
import { Node } from 'estree-walker';
import { parseHtmlx } from '../htmlxparser';
import svgAttributes from './svgattributes';
import { getTypeForComponent } from './nodes/component-type';
import { handleAwait } from './nodes/await-block';
import { getSlotName } from '../utils/svelteAst';
import { getSingleSlotDef } from '../nodes/slot';

type ElementType = string;
const oneWayBindingAttributes: Map<string, ElementType> = new Map(
    ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']
        .map((e) => [e, 'HTMLDivElement'] as [string, string])
        .concat(
            ['duration', 'buffered', 'seekable', 'seeking', 'played', 'ended'].map((e) => [
                e,
                'HTMLMediaElement',
            ]),
        ),
);

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
    'volume',
]);

const beforeStart = (start: number) => start - 1;

type Walker = (node: Node, parent: Node, prop: string, index: number) => void;

const stripDoctype = (str: MagicString) => {
    const regex = /<!doctype(.+?)>(\n)?/i;
    const result = regex.exec(str.original);
    if (result) str.remove(result.index, result.index + result[0].length);
};

export function convertHtmlxToJsx(
    str: MagicString,
    ast: Node,
    onWalk: Walker = null,
    onLeave: Walker = null,
) {
    const htmlx = str.original;
    stripDoctype(str);
    str.prepend('<>');
    str.append('</>');
    const handleRaw = (rawBlock: Node) => {
        const tokenStart = htmlx.indexOf('@html', rawBlock.start);
        str.remove(tokenStart, tokenStart + '@html'.length);
    };
    const handleDebug = (debugBlock: Node) => {
        const tokenStart = htmlx.indexOf('@debug', debugBlock.start);
        str.remove(tokenStart, tokenStart + '@debug'.length);
    };

    const handleEventHandler = (attr: Node, parent: Node) => {
        const jsxEventName = attr.name;

        if (
            ['Element', 'Window', 'Body'].includes(
                parent.type,
            ) /*&& KnownEvents.indexOf('on'+jsxEventName) >= 0*/
        ) {
            if (attr.expression) {
                const endAttr = htmlx.indexOf('=', attr.start);
                str.overwrite(attr.start + 'on:'.length - 1, endAttr, jsxEventName);
                if (htmlx[attr.end - 1] == '"') {
                    const firstQuote = htmlx.indexOf('"', endAttr);
                    str.remove(firstQuote, firstQuote + 1);
                    str.remove(attr.end - 1, attr.end);
                }
            } else {
                str.overwrite(
                    attr.start + 'on:'.length - 1,
                    attr.end,
                    `${jsxEventName}={undefined}`,
                );
            }
        } else {
            if (attr.expression) {
                const on = 'on';
                //for handler assignment, we changeIt to call to our __sveltets_ensureFunction
                str.appendRight(
                    attr.start,
                    `{__sveltets_instanceOf(${getTypeForComponent(parent)}).$`,
                );
                const eventNameIndex = htmlx.indexOf(':', attr.start) + 1;
                str.overwrite(htmlx.indexOf(on, attr.start) + on.length, eventNameIndex, `('`);
                const eventEnd = htmlx.lastIndexOf('=', attr.expression.start);
                str.overwrite(eventEnd, attr.expression.start, `', `);
                str.overwrite(attr.expression.end, attr.end, ')}');
                str.move(attr.start, attr.end, parent.end);
            } else {
                //for passthrough handlers, we just remove
                str.remove(attr.start, attr.end);
            }
        }
    };

    const handleClassDirective = (attr: Node) => {
        str.overwrite(attr.start, attr.expression.start, `{...__sveltets_ensureType(Boolean, !!(`);
        const endBrackets = `))}`;
        if (attr.end !== attr.expression.end) {
            str.overwrite(attr.expression.end, attr.end, endBrackets);
        } else {
            str.appendLeft(attr.end, endBrackets);
        }
    };

    const handleActionDirective = (attr: Node, parent: Node) => {
        str.overwrite(
            attr.start,
            attr.start + 'use:'.length,
            `{...__sveltets_ensureAction(__sveltets_mapElementTag('${parent.name}'),`,
        );

        if (!attr.expression) {
            str.appendLeft(attr.end, ')}');
            return;
        }

        str.overwrite(attr.start + `use:${attr.name}`.length, attr.expression.start, ',');
        str.appendLeft(attr.expression.end, ')');
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    };

    const handleTransitionDirective = (attr: Node) => {
        str.overwrite(
            attr.start,
            htmlx.indexOf(':', attr.start) + 1,
            '{...__sveltets_ensureTransition(',
        );

        if (attr.modifiers.length) {
            const local = htmlx.indexOf('|', attr.start);
            str.remove(local, attr.expression ? attr.expression.start : attr.end);
        }

        if (!attr.expression) {
            str.appendLeft(attr.end, ', {})}');
            return;
        }

        str.overwrite(
            htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
            attr.expression.start,
            ', ',
        );
        str.appendLeft(attr.expression.end, ')');
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    };

    const handleAnimateDirective = (attr: Node) => {
        str.overwrite(
            attr.start,
            htmlx.indexOf(':', attr.start) + 1,
            '{...__sveltets_ensureAnimation(',
        );

        if (!attr.expression) {
            str.appendLeft(attr.end, ', {})}');
            return;
        }
        str.overwrite(
            htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
            attr.expression.start,
            ', ',
        );
        str.appendLeft(attr.expression.end, ')');
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    };

    const isShortHandAttribute = (attr: Node) => {
        return attr.expression.end === attr.end;
    };

    const handleBinding = (attr: Node, el: Node) => {
        const getThisType = (node: Node) => {
            switch (node.type) {
                case 'InlineComponent':
                    return getTypeForComponent(node);
                case 'Element':
                    return `__sveltets_ctorOf(__sveltets_mapElementTag('${node.name}'))`;
                case 'Body':
                    return 'HTMLBodyElement';
                default:
                    break;
            }
        };

        //bind group on input
        if (attr.name == 'group' && el.name == 'input') {
            str.remove(attr.start, attr.expression.start);
            str.appendLeft(attr.expression.start, '{...__sveltets_empty(');

            const endBrackets = ')}';
            if (isShortHandAttribute(attr)) {
                str.prependRight(attr.end, endBrackets);
            } else {
                str.overwrite(attr.expression.end, attr.end, endBrackets);
            }
            return;
        }

        const supportsBindThis = ['InlineComponent', 'Element', 'Body'];

        //bind this
        if (attr.name == 'this' && supportsBindThis.includes(el.type)) {
            const thisType = getThisType(el);

            if (thisType) {
                str.remove(attr.start, attr.expression.start);
                str.appendLeft(attr.expression.start, `{...__sveltets_ensureType(${thisType}, `);
                str.overwrite(attr.expression.end, attr.end, ')}');
                return;
            }
        }

        //one way binding
        if (oneWayBindingAttributes.has(attr.name) && el.type == 'Element') {
            str.remove(attr.start, attr.expression.start);
            str.appendLeft(attr.expression.start, `{...__sveltets_empty(`);
            if (isShortHandAttribute(attr)) {
                // eslint-disable-next-line max-len
                str.appendLeft(
                    attr.end,
                    `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${
                        attr.name
                    })}`,
                );
            } else {
                // eslint-disable-next-line max-len
                str.overwrite(
                    attr.expression.end,
                    attr.end,
                    `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${
                        attr.name
                    })}`,
                );
            }
            return;
        }

        str.remove(attr.start, attr.start + 'bind:'.length);
        if (attr.expression.start == attr.start + 'bind:'.length) {
            str.prependLeft(attr.expression.start, `${attr.name}={`);
            str.appendLeft(attr.end, `}`);
            return;
        }

        //remove possible quotes
        if (htmlx[attr.end - 1] == '"') {
            const firstQuote = htmlx.indexOf('"', attr.start);
            str.remove(firstQuote, firstQuote + 1);
            str.remove(attr.end - 1, attr.end);
        }
    };

    const handleSlot = (slotEl: Node, component: Node, slotName: string) => {
        //collect "let" definitions
        let hasMoved = false;
        let afterTag: number;
        for (const attr of slotEl.attributes) {
            if (attr.type != 'Let') continue;

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
        if (!hasMoved) return;
        str.appendLeft(afterTag, '{() => { let {');
        str.appendRight(
            afterTag,
            `} = ${getSingleSlotDef(component, slotName)}`+ ';<>',
        );

        const closeTagStart = htmlx.lastIndexOf('<', slotEl.end);
        str.appendLeft(closeTagStart, '</>}}');
    };

    const handleComponent = (el: Node) => {
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
        handleSlot(el, el, 'default');

        //walk the direct children looking for slots. We do this here because we need the name of our component for handleSlot
        //we could lean on leave/enter, but I am lazy
        if (!el.children) return;
        for (const child of el.children) {
            const slotName = getSlotName(child);
            if (slotName) {
                handleSlot(child, el, slotName);
            }
        }
    };

    const handleAttribute = (attr: Node, parent: Node) => {
        //if we are on an "element" we are case insensitive, lowercase to match our JSX
        if (parent.type == 'Element') {
            //skip Attribute shorthand, that is handled below
            const sapperNoScroll = attr.name === 'sapper:noscroll';
            if (
                (attr.value !== true &&
                    !(
                        attr.value.length &&
                        attr.value.length == 1 &&
                        attr.value[0].type == 'AttributeShorthand'
                    )) ||
                sapperNoScroll
            ) {
                let name = attr.name;
                if (!svgAttributes.find((x) => x == name)) {
                    name = name.toLowerCase();
                }

                //strip ":" from out attribute name and uppercase the next letter to convert to jsx attribute
                const colonIndex = name.indexOf(':');
                if (colonIndex >= 0) {
                    const parts = name.split(':');
                    name = parts[0] + parts[1][0].toUpperCase() + parts[1].substring(1);
                }

                str.overwrite(attr.start, attr.start + attr.name.length, name);
            }
        }

        //we are a bare attribute
        if (attr.value === true) return;

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
                    // eslint-disable-next-line max-len
                    attrName = svgAttributes.find((a) => a == attrName)
                        ? attrName
                        : attrName.toLowerCase();
                }

                str.appendRight(attr.start, `${attrName}=`);
                return;
            }

            const equals = htmlx.lastIndexOf('=', attrVal.start);
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

        if (htmlx[attr.end - 1] == '"') {
            str.overwrite(attr.end - 1, attr.end, '`}');
        } else {
            str.appendLeft(attr.end, '`}');
        }
    };

    const handleElement = (node: Node) => {
        //we just have to self close void tags since jsx always wants the />
        const voidTags = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(
            ',',
        );
        if (voidTags.find((x) => x == node.name)) {
            if (htmlx[node.end - 2] != '/') {
                str.appendRight(node.end - 1, '/');
            }
        }

        //some tags auto close when they encounter certain elements, jsx doesn't support this
        if (htmlx[node.end - 1] != '>') {
            str.appendRight(node.end, `</${node.name}>`);
        }
    };

    const handleIf = (ifBlock: Node) => {
        if (ifBlock.elseif) {
            //we are an elseif so our work is easier
            str.appendLeft(ifBlock.expression.start, '(');
            str.appendLeft(ifBlock.expression.end, ')');
            return;
        }
        // {#if expr} ->
        // {() => { if (expr){ <>
        str.overwrite(ifBlock.start, ifBlock.expression.start, '{() => {if (');
        const end = htmlx.indexOf('}', ifBlock.expression.end);
        str.overwrite(ifBlock.expression.end, end + 1, '){<>');

        // {/if} -> </>}}}</>
        const endif = htmlx.lastIndexOf('{', ifBlock.end);
        str.overwrite(endif, ifBlock.end, '</>}}}');
    };

    // {:else} -> </>} else {<>
    const handleElse = (elseBlock: Node, parent: Node) => {
        if (parent.type != 'IfBlock') return;
        const elseEnd = htmlx.lastIndexOf('}', elseBlock.start);
        const elseword = htmlx.lastIndexOf(':else', elseEnd);
        const elseStart = htmlx.lastIndexOf('{', elseword);
        str.overwrite(elseStart, elseStart + 1, '</>}');
        str.overwrite(elseEnd, elseEnd + 1, '{<>');
        const colon = htmlx.indexOf(':', elseword);
        str.remove(colon, colon + 1);
    };

    const handleEach = (eachBlock: Node) => {
        // {#each items as item,i (key)} ->
        // {__sveltets_each(items, (item,i) => (key) && <>
        str.overwrite(eachBlock.start, eachBlock.expression.start, '{__sveltets_each(');
        str.overwrite(eachBlock.expression.end, eachBlock.context.start, ', (');
        let contextEnd = eachBlock.context.end;
        if (eachBlock.index) {
            const idxLoc = htmlx.indexOf(eachBlock.index, contextEnd);
            contextEnd = idxLoc + eachBlock.index.length;
        }
        str.prependLeft(contextEnd, ') =>');
        if (eachBlock.key) {
            const endEachStart = htmlx.indexOf('}', eachBlock.key.end);
            str.overwrite(endEachStart, endEachStart + 1, ' && <>');
        } else {
            const endEachStart = htmlx.indexOf('}', contextEnd);
            str.overwrite(endEachStart, endEachStart + 1, ' <>');
        }
        const endEach = htmlx.lastIndexOf('{', eachBlock.end);
        // {/each} -> </>)} or {:else} -> </>)}
        if (eachBlock.else) {
            const elseEnd = htmlx.lastIndexOf('}', eachBlock.else.start);
            const elseStart = htmlx.lastIndexOf('{', elseEnd);
            str.overwrite(elseStart, elseEnd + 1, '</>)}');
            str.remove(endEach, eachBlock.end);
        } else {
            str.overwrite(endEach, eachBlock.end, '</>)}');
        }
    };

    const handleComment = (node: Node) => {
        str.remove(node.start, node.end);
    };

    const handleSvelteTag = (node: Node) => {
        const colon = htmlx.indexOf(':', node.start);
        str.remove(colon, colon + 1);

        const closeTag = htmlx.lastIndexOf('/' + node.name, node.end);
        if (closeTag > node.start) {
            const colon = htmlx.indexOf(':', closeTag);
            str.remove(colon, colon + 1);
        }
    };

    (svelte as any).walk(ast, {
        enter: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        handleIf(node);
                        break;
                    case 'EachBlock':
                        handleEach(node);
                        break;
                    case 'ElseBlock':
                        handleElse(node, parent);
                        break;
                    case 'AwaitBlock':
                        handleAwait(htmlx, str, node);
                        break;
                    case 'RawMustacheTag':
                        handleRaw(node);
                        break;
                    case 'DebugTag':
                        handleDebug(node);
                        break;
                    case 'InlineComponent':
                        handleComponent(node);
                        break;
                    case 'Element':
                        handleElement(node);
                        break;
                    case 'Comment':
                        handleComment(node);
                        break;
                    case 'Binding':
                        handleBinding(node, parent);
                        break;
                    case 'Class':
                        handleClassDirective(node);
                        break;
                    case 'Action':
                        handleActionDirective(node, parent);
                        break;
                    case 'Transition':
                        handleTransitionDirective(node);
                        break;
                    case 'Animation':
                        handleAnimateDirective(node);
                        break;
                    case 'Attribute':
                        handleAttribute(node, parent);
                        break;
                    case 'EventHandler':
                        handleEventHandler(node, parent);
                        break;
                    case 'Options':
                        handleSvelteTag(node);
                        break;
                    case 'Window':
                        handleSvelteTag(node);
                        break;
                    case 'Head':
                        handleSvelteTag(node);
                        break;
                    case 'Body':
                        handleSvelteTag(node);
                        break;
                }
                if (onWalk) onWalk(node, parent, prop, index);
            } catch (e) {
                console.error('Error walking node ', node);
                throw e;
            }
        },

        leave: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                if (onLeave) onLeave(node, parent, prop, index);
            } catch (e) {
                console.error('Error leaving node ', node);
                throw e;
            }
        },
    });
}

export function htmlx2jsx(htmlx: string) {
    const ast = parseHtmlx(htmlx);
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, ast);

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString(),
    };
}
