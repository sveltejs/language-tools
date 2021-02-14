import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { isQuote } from '../utils/node-utils';

/**
 * transition:xxx(yyy)   --->   {...__sveltets_ensureTransition(xxx(__sveltets_mapElementTag('..'),(yyy)))}
 */
export function handleTransitionDirective(
    htmlx: string,
    str: MagicString,
    attr: Node,
    parent: Node
): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_ensureTransition('
    );

    if (attr.modifiers.length) {
        const local = htmlx.indexOf('|', attr.start);
        str.remove(local, attr.expression ? attr.expression.start : attr.end);
    }

    const nodeType = `__sveltets_mapElementTag('${parent.name}')`;

    if (!attr.expression) {
        if (transitionsThatNeedParam.has(attr.name)) {
            str.appendLeft(attr.end, `(${nodeType},{}))}`);
        } else {
            str.appendLeft(attr.end, `(${nodeType}))}`);
        }
        return;
    }

    str.overwrite(
        htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
        attr.expression.start,
        `(${nodeType},(`
    );
    str.appendLeft(attr.expression.end, ')))');
    if (isQuote(htmlx[attr.end - 1])) {
        str.remove(attr.end - 1, attr.end);
    }
}

/**
 * Up to Svelte version 3.32.0, the following built-in transition functions have
 * optional parameters, but according to its typings they were mandatory.
 * To not show unnecessary type errors to those users, `{}` should be added
 * as a fallback parameter if the user did not provide one.
 * It may be the case that someone has a custom transition with the same name
 * that expects different parameters, or that someone did an import alias fly as foo,
 * but those are very unlikely.
 *
 * Remove this "hack" some day.
 */
const transitionsThatNeedParam = new Set(['blur', 'fade', 'fly', 'slide', 'scale', 'draw']);
