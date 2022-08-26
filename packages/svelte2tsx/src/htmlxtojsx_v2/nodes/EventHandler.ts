import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { rangeWithTrailingPropertyAccess, surroundWith } from '../utils/node-utils';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * Transform on:xxx={yyy}
 * - For DOM elements: ---> onxxx: yyy,
 * - For Svelte components/special elements: ---> componentInstance.$on("xxx", yyy)}
 */
export function handleEventHandler(
    str: MagicString,
    attr: BaseDirective,
    element: Element | InlineComponent
): void {
    const nameStart = str.original.indexOf(':', attr.start) + 1;
    // If there's no expression, it's event bubbling (on:click)
    const nameEnd = nameStart + attr.name.length;

    if (element instanceof Element) {
        // Prefix with "on:" for better mapping.
        // Surround with quotes because event name could contain invalid prop chars.
        surroundWith(str, [nameStart, nameEnd], '"on:', '"');
        element.addAttribute(
            [[nameStart, nameEnd]],
            attr.expression
                ? [rangeWithTrailingPropertyAccess(str.original, attr.expression)]
                : ['undefined']
        );
    } else {
        element.addEvent(
            [nameStart, nameEnd],
            attr.expression
                ? rangeWithTrailingPropertyAccess(str.original, attr.expression)
                : undefined
        );
    }
}
