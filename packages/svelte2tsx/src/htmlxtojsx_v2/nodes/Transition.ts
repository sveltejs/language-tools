import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx, TransformationArray } from '../utils/node-utils';
import { Element } from './Element';

/**
 * transition|modifier:xxx(yyy)   --->   __sveltets_2_ensureTransition(xxx(__sveltets_2_mapElementTag('..'),(yyy)));
 */
export function handleTransitionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const transformations: TransformationArray = [
        '__sveltets_2_ensureTransition(',
        getDirectiveNameStartEndIdx(str, attr),
        `(__sveltets_2_mapElementTag('${element.tagName}')`
    ];
    if (attr.expression) {
        transformations.push(',(', [attr.expression.start, attr.expression.end], ')');
    }
    transformations.push('));');
    element.appendToStartEnd(transformations);
}
