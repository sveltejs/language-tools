import MagicString from 'magic-string';
import {
    getEnd,
    isTypescriptNode,
    rangeWithTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';
import { surroundWithIgnoreComments } from '../../utils/ignore';

/**
 * List of binding names that are transformed to sth like `binding = variable`.
 */
const oneWayBindingAttributes: Set<string> = new Set([
    'clientWidth',
    'clientHeight',
    'offsetWidth',
    'offsetHeight',
    'duration',
    'seeking',
    'ended',
    'readyState',
    'naturalWidth',
    'naturalHeight'
]);

/**
 * List of binding names that are transformed to sth like `binding = variable as GeneratedCode`.
 */
const oneWayBindingAttributesNotOnElement: Map<string, string> = new Map([
    ['contentRect', 'DOMRectReadOnly'],
    ['contentBoxSize', 'ResizeObserverSize[]'],
    ['borderBoxSize', 'ResizeObserverSize[]'],
    ['devicePixelContentBoxSize', 'ResizeObserverSize[]'],
    // available on the element, but with a different type
    ['buffered', "import('svelte/elements').SvelteMediaTimeRange[]"],
    ['played', "import('svelte/elements').SvelteMediaTimeRange[]"],
    ['seekable', "import('svelte/elements').SvelteMediaTimeRange[]"]
]);

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
    preserveBind: boolean,
    isSvelte5Plus: boolean
): void {
    // bind group on input
    if (element instanceof Element && attr.name == 'group' && parent.name == 'input') {
        // add reassignment to force TS to widen the type of the declaration (in case it's never reassigned anywhere else)
        appendOneWayBinding(attr, ' = __sveltets_2_any(null)', element);
        return;
    }

    // bind this
    if (attr.name === 'this' && supportsBindThis.includes(parent.type)) {
        // bind:this is effectively only works bottom up - the variable is updated by the element, not
        // the other way round. So we check if the instance is assignable to the variable.
        // Note: If the component unmounts (it's inside an if block, or svelte:component this={null},
        // the value becomes null, but we don't add it to the clause because it would introduce
        // worse DX for the 99% use case, and because null !== undefined which others might use to type the declaration.
        appendOneWayBinding(attr, ` = ${element.name}`, element);
        return;
    }

    // one way binding
    if (oneWayBindingAttributes.has(attr.name) && element instanceof Element) {
        appendOneWayBinding(attr, `= ${element.name}.${attr.name}`, element);
        return;
    }

    // one way binding whose property is not on the element
    if (oneWayBindingAttributesNotOnElement.has(attr.name) && element instanceof Element) {
        element.appendToStartEnd([
            [attr.expression.start, getEnd(attr.expression)],
            `= ${surroundWithIgnoreComments(
                `null as ${oneWayBindingAttributesNotOnElement.get(attr.name)}`
            )};`
        ]);
        return;
    }

    // add reassignment to force TS to widen the type of the declaration (in case it's never reassigned anywhere else)
    const expressionStr = str.original.substring(attr.expression.start, getEnd(attr.expression));
    element.appendToStartEnd([
        surroundWithIgnoreComments(`() => ${expressionStr} = __sveltets_2_any(null);`)
    ]);

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
              : [
                    [
                        attr.start + 'bind:'.length,
                        str.original.lastIndexOf('=', attr.expression.start)
                    ]
                ];

    const value: TransformationArray | undefined = isShorthand
        ? preserveBind && element instanceof Element
            ? [rangeWithTrailingPropertyAccess(str.original, attr.expression)]
            : undefined
        : [rangeWithTrailingPropertyAccess(str.original, attr.expression)];

    if (isSvelte5Plus && element instanceof InlineComponent) {
        // To check if property is actually bindable
        element.appendToStartEnd([`${element.name}.$$bindings = '${attr.name}';`]);
    }

    if (element instanceof Element) {
        element.addAttribute(name, value);
    } else {
        element.addProp(name, value);
    }
}

function appendOneWayBinding(
    attr: BaseDirective,
    assignment: string,
    element: Element | InlineComponent
) {
    const expression = attr.expression;
    const end = getEnd(expression);
    const hasTypeAnnotation = expression.typeAnnotation || isTypescriptNode(expression);
    const array: TransformationArray = [
        [expression.start, end],
        assignment + (hasTypeAnnotation ? '' : ';')
    ];
    if (hasTypeAnnotation) {
        array.push([end, expression.end], ';');
    }
    element.appendToStartEnd(array);
}
