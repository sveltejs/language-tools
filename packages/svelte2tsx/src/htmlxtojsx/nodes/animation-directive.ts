import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { isQuote } from '../utils/node-utils';

/**
 * animate:xxx(yyy)   --->   {...__sveltets_ensureAnimation(xxx(__sveltets_mapElementTag('..'),__sveltets_AnimationMove,(yyy)))}
 */
export function handleAnimateDirective(
    htmlx: string,
    str: MagicString,
    attr: Node,
    parent: Node
): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_ensureAnimation('
    );

    const nodeType = `__sveltets_mapElementTag('${parent.name}')`;

    if (!attr.expression) {
        if (animationsThatNeedParam.has(attr.name)) {
            str.appendLeft(attr.end, `(${nodeType},__sveltets_AnimationMove,{}))}`);
        } else {
            str.appendLeft(attr.end, `(${nodeType},__sveltets_AnimationMove))}`);
        }
        return;
    }
    str.overwrite(
        htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
        attr.expression.start,
        `(${nodeType},__sveltets_AnimationMove,(`
    );
    str.appendLeft(attr.expression.end, ')))');
    if (isQuote(htmlx[attr.end - 1])) {
        str.remove(attr.end - 1, attr.end);
    }
}

/**
 * Up to Svelte version 3.32.0, the following built-in animate functions have
 * optional parameters, but according to its typings they were mandatory.
 * To not show unnecessary type errors to those users, `{}` should be added
 * as a fallback parameter if the user did not provide one.
 * It may be the case that someone has a custom animation with the same name
 * that expects different parameters, or that someone did an import alias fly as foo,
 * but those are very unlikely.
 *
 * Remove this "hack" some day.
 */
const animationsThatNeedParam = new Set(['flip']);
