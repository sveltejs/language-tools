import MagicString from 'magic-string';
import { isShortHandAttribute, getInstanceTypeSimple, isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';

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
 * List of all binding names that are transformed to sth like `binding = variable`.
 * This applies to readonly bindings and the this binding.
 */
export const assignmentBindings = new Set([...oneWayBindingAttributes.keys(), 'this']);

/**
 * Transform bind:xxx into something that conforms to JSX
 */
export function handleBinding(
    htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    el: BaseNode
): void {
    //bind group on input
    if (attr.name == 'group' && el.name == 'input') {
        str.remove(attr.start, attr.expression.start);
        str.appendLeft(attr.expression.start, '{...__sveltets_1_empty(');

        const endBrackets = ')}';
        if (isShortHandAttribute(attr)) {
            str.prependRight(attr.end, endBrackets);
        } else {
            str.overwrite(attr.expression.end, attr.end, endBrackets);
        }
        return;
    }

    const supportsBindThis = [
        'InlineComponent',
        'Element',
        'Body',
        'Slot' // only valid for Web Components compile target
    ];

    //bind this
    if (attr.name === 'this' && supportsBindThis.includes(el.type)) {
        // bind:this is effectively only works bottom up - the variable is updated by the element, not
        // the other way round. So we check if the instance is assignable to the variable.
        // Some notes:
        // - If the component unmounts (it's inside an if block, or svelte:component this={null},
        //   the value becomes null, but we don't add it to the clause because it would introduce
        //   worse DX for the 99% use case, and because null !== undefined which others might use to type the declaration.
        // - This doesn't do a 100% correct job of infering the instance type in case someone used generics for input props.
        //   For now it errs on the side of "no false positives" at the cost of maybe some missed type bugs
        const thisType = getInstanceTypeSimple(el, str);

        if (thisType) {
            str.overwrite(attr.start, attr.expression.start, '{...__sveltets_1_empty(');
            const instanceOfThisAssignment = ' = ' + surroundWithIgnoreComments(thisType) + ')}';
            str.overwrite(attr.expression.end, attr.end, instanceOfThisAssignment);
            return;
        }
    }

    //one way binding
    if (oneWayBindingAttributes.has(attr.name) && el.type === 'Element') {
        str.remove(attr.start, attr.expression.start);
        str.appendLeft(attr.expression.start, '{...__sveltets_1_empty(');
        if (isShortHandAttribute(attr)) {
            // eslint-disable-next-line max-len
            str.appendLeft(
                attr.end,
                `=__sveltets_1_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`
            );
        } else {
            // eslint-disable-next-line max-len
            str.overwrite(
                attr.expression.end,
                attr.end,
                `=__sveltets_1_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`
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
    const lastChar = htmlx[attr.end - 1];
    if (isQuote(lastChar)) {
        const firstQuote = htmlx.indexOf(lastChar, attr.start);
        str.remove(firstQuote, firstQuote + 1);
        str.remove(attr.end - 1, attr.end);
    }
}
