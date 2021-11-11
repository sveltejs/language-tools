import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx } from '../utils/node-utils';
import { Element } from './Element';

/**
 * transition|modifier:xxx(yyy)   --->   __sveltets_2_ensureTransition(xxx(__sveltets_2_mapElementTag('..'),(yyy)));
 */
export function handleTransitionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    element.appendToStartEnd([
        '__sveltets_2_ensureTransition(',
        getDirectiveNameStartEndIdx(str, attr),
        `(__sveltets_2_mapElementTag('${element.tagName}'),(`,
        attr.expression ? [attr.expression.start, attr.expression.end] : '{}',
        ')));'
    ]);
}
