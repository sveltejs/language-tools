import MagicString from 'magic-string';
import { getInstanceType, isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';

/**
 * Transform on:xxx={yyy}
 * - For DOM elements: ---> onxxx={yyy}
 * - For Svelte components/special elements: ---> {__sveltets_1_instanceOf(..ComponentType..).$on("xxx", yyy)}
 */
export function handleEventHandler(
    htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode
): void {
    const jsxEventName = attr.name;

    if (
        ['Element', 'Window', 'Body'].includes(
            parent.type
        ) /*&& KnownEvents.indexOf('on'+jsxEventName) >= 0*/
    ) {
        if (attr.expression) {
            const endAttr = htmlx.indexOf('=', attr.start);
            str.overwrite(attr.start + 'on:'.length - 1, endAttr, jsxEventName);
            const lastChar = htmlx[attr.end - 1];
            if (isQuote(lastChar)) {
                const firstQuote = htmlx.indexOf(lastChar, endAttr);
                str.remove(firstQuote, firstQuote + 1);
                str.remove(attr.end - 1, attr.end);
            }
        } else {
            str.overwrite(attr.start + 'on:'.length - 1, attr.end, `${jsxEventName}={undefined}`);
        }
    } else {
        if (attr.expression) {
            const on = 'on';
            //for handler assignment, we change it to call to our __sveltets_1_ensureFunction
            str.appendRight(attr.start, `{${getInstanceType(parent, str.original)}.$`);
            const eventNameIndex = htmlx.indexOf(':', attr.start) + 1;
            str.overwrite(htmlx.indexOf(on, attr.start) + on.length, eventNameIndex, "('");
            const eventEnd = htmlx.lastIndexOf('=', attr.expression.start);
            str.overwrite(eventEnd, attr.expression.start, "', ");
            str.overwrite(attr.expression.end, attr.end, ')}');
            str.move(attr.start, attr.end, parent.end);
        } else {
            //for passthrough handlers, we just remove
            str.remove(attr.start, attr.end);
        }
    }
}
