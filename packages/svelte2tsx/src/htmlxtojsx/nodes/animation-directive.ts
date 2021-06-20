import MagicString from 'magic-string';
import { isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';

/**
 * animate:xxx(yyy)   --->   {...__sveltets_1_ensureAnimation(xxx(__sveltets_1_mapElementTag('..'),__sveltets_1_AnimationMove,(yyy)))}
 */
export function handleAnimateDirective(
    htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode
): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_1_ensureAnimation('
    );

    const nodeType = `__sveltets_1_mapElementTag('${parent.name}')`;

    if (!attr.expression) {
        str.appendLeft(attr.end, `(${nodeType},__sveltets_1_AnimationMove,{}))}`);
        return;
    }
    str.overwrite(
        htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
        attr.expression.start,
        `(${nodeType},__sveltets_1_AnimationMove,(`
    );
    str.appendLeft(attr.expression.end, ')))');
    if (isQuote(htmlx[attr.end - 1])) {
        str.remove(attr.end - 1, attr.end);
    }
}
