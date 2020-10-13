import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { isShortHandAttribute, getThisType } from '../utils/node-utils';

const oneWayBindingAttributes: Map<string, string> = new Map(
    ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']
        .map((e) => [e, 'HTMLDivElement'] as [string, string])
        .concat(
            ['duration', 'buffered', 'seekable', 'seeking', 'played', 'ended'].map((e) => [
                e,
                'HTMLMediaElement'
            ])
        )
);

/**
 * Transform bind:xxx into something that conforms to JSX
 */
export function handleBinding(htmlx: string, str: MagicString, attr: Node, el: Node): void {
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
    if (attr.name === 'this' && supportsBindThis.includes(el.type)) {
        const thisType = getThisType(el);

        if (thisType) {
            str.remove(attr.start, attr.expression.start);
            str.appendLeft(attr.expression.start, `{...__sveltets_ensureType(${thisType}, `);
            str.overwrite(attr.expression.end, attr.end, ')}');
            return;
        }
    }

    //one way binding
    if (oneWayBindingAttributes.has(attr.name) && el.type === 'Element') {
        str.remove(attr.start, attr.expression.start);
        str.appendLeft(attr.expression.start, '{...__sveltets_empty(');
        if (isShortHandAttribute(attr)) {
            // eslint-disable-next-line max-len
            str.appendLeft(
                attr.end,
                `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`
            );
        } else {
            // eslint-disable-next-line max-len
            str.overwrite(
                attr.expression.end,
                attr.end,
                `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`
            );
        }
        return;
    }

    str.remove(attr.start, attr.start + 'bind:'.length);
    if (attr.expression.start === attr.start + 'bind:'.length) {
        str.prependLeft(attr.expression.start, `${attr.name}={`);
        str.appendLeft(attr.end, '}');
        return;
    }

    //remove possible quotes
    if (htmlx[attr.end - 1] === '"') {
        const firstQuote = htmlx.indexOf('"', attr.start);
        str.remove(firstQuote, firstQuote + 1);
        str.remove(attr.end - 1, attr.end);
    }
}
