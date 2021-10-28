import MagicString from 'magic-string';
import { isShortHandAttribute, getThisType, isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';

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
        const thisType = getThisType(el);

        if (el.type === 'InlineComponent') {
            // bind:this is effectively only works bottom up - the variable is updated by the element, not
            // the other way round. So we check if the instance is assignable to the variable. We get the
            // instance from the class with instanceOf. The class for svelte:component can be anything
            // specified in the this={x} expression - so we copy its contents.
            // TODO: For svelte:self, getThisType returns effectively nothing, so it's not typechecked
            // In other cases, it's just the Component class.
            //
            // If the component unmounts (it's inside an if block, or svelte:component this={null},
            // the value also becomes null, so we add that to the clause as well.

            str.overwrite(attr.start, attr.expression.start, '{...__sveltets_1_empty((');
            str.appendLeft(attr.expression.end, ' = __sveltets_1_instanceOf(');
            if (el.name === 'svelte:component') {
                str.copy(el.expression.start, el.expression.end, attr.expression.end);
            } else {
                str.appendLeft(attr.expression.end, thisType);
            }
            str.overwrite(attr.expression.end, attr.end, ') || null))}');

            return;
        } else if (thisType) {
            str.remove(attr.start, attr.expression.start);
            str.appendLeft(attr.expression.start, `{...__sveltets_1_ensureType(${thisType}, `);
            str.overwrite(attr.expression.end, attr.end, ')}');
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
