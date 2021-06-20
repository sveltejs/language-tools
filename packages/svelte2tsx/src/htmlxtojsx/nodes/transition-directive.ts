import MagicString from 'magic-string';
import { isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';

/**
 * transition:xxx(yyy)   --->   {...__sveltets_1_ensureTransition(xxx(__sveltets_1_mapElementTag('..'),(yyy)))}
 */
export function handleTransitionDirective(
    htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode
): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_1_ensureTransition('
    );

    if (attr.modifiers.length) {
        const local = htmlx.indexOf('|', attr.start);
        str.remove(local, attr.expression ? attr.expression.start : attr.end);
    }

    const nodeType = `__sveltets_1_mapElementTag('${parent.name}')`;

    if (!attr.expression) {
        str.appendLeft(attr.end, `(${nodeType},{}))}`);
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
