import MagicString from 'magic-string';
import { rangeWithTrailingPropertyAccess, TransformationArray } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

const oneWayBindingAttributes: Set<string> = new Set([
    'clientWidth',
    'clientHeight',
    'offsetWidth',
    'offsetHeight',
    'duration',
    'buffered',
    'seekable',
    'seeking',
    'played',
    'ended'
]);
/**
 * List of all binding names that are transformed to sth like `binding = variable`.
 * This applies to readonly bindings and the this binding.
 */
export const assignmentBindings = new Set([...oneWayBindingAttributes.keys(), 'this']);

const supportsBindThis = [
    'InlineComponent',
    'Element',
    'Body',
    'Slot' // only valid for Web Components compile target
];

/**
 * Transform bind:xxx into something that conforms to JS/TS
 */
export function handleBinding(
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode,
    element: Element | InlineComponent,
    preserveBind: boolean
): void {
    // bind group on input
    if (element instanceof Element && attr.name == 'group' && parent.name == 'input') {
        element.appendToStartEnd([
            rangeWithTrailingPropertyAccess(str.original, attr.expression),
            ';'
        ]);
        return;
    }

    // bind this
    if (attr.name === 'this' && supportsBindThis.includes(parent.type)) {
        // bind:this is effectively only works bottom up - the variable is updated by the element, not
        // the other way round. So we check if the instance is assignable to the variable.
        // Note: If the component unmounts (it's inside an if block, or svelte:component this={null},
        // the value becomes null, but we don't add it to the clause because it would introduce
        // worse DX for the 99% use case, and because null !== undefined which others might use to type the declaration.
        element.appendToStartEnd([
            [attr.expression.start, attr.expression.end],
            ` = ${element.name};`
        ]);
        return;
    }

    // one way binding
    if (oneWayBindingAttributes.has(attr.name) && element instanceof Element) {
        element.appendToStartEnd([
            [attr.expression.start, attr.expression.end],
            `= ${element.name}.${attr.name};`
        ]);
        return;
    }

    // other bindings which are transformed to normal attributes/props
    const isShorthand = attr.expression.start === attr.start + 'bind:'.length;
    const name: TransformationArray =
        preserveBind && element instanceof Element
            ? // HTML typings - preserve the bind: prefix
              isShorthand
                ? [`"${str.original.substring(attr.start, attr.end)}"`]
                : [
                      `"${str.original.substring(
                          attr.start,
                          str.original.lastIndexOf('=', attr.expression.start)
                      )}"`
                  ]
            : // Other typings - remove the bind: prefix
            isShorthand
            ? [[attr.expression.start, attr.expression.end]]
            : [[attr.start + 'bind:'.length, str.original.lastIndexOf('=', attr.expression.start)]];
    const value: TransformationArray | undefined = isShorthand
        ? preserveBind && element instanceof Element
            ? [rangeWithTrailingPropertyAccess(str.original, attr.expression)]
            : undefined
        : [rangeWithTrailingPropertyAccess(str.original, attr.expression)];
    if (element instanceof Element) {
        element.addAttribute(name, value);
    } else {
        element.addProp(name, value);
    }
}
