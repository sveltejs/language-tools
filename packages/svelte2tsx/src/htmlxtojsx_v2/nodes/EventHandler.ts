import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
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
    const nameEnd = attr.expression ? str.original.indexOf('=', attr.start) : attr.end;

    if (element instanceof Element) {
        element.addAttribute(
            ['on', [nameStart, nameEnd]],
            attr.expression ? [[attr.expression.start, attr.expression.end]] : undefined
        );
    } else {
        element.addEvent(
            [nameStart, nameEnd],
            attr.expression ? [attr.expression.start, attr.expression.end] : undefined
        );
    }
}
