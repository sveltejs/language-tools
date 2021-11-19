import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx, TransformationArray } from '../utils/node-utils';
import { Element } from './Element';

/**
 * animate:xxx(yyy)   --->   __sveltets_2_ensureAnimation(xxx(__sveltets_1_mapElementTag('..'),__sveltets_2_AnimationMove,(yyy)));
 */
export function handleAnimateDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const transformations: TransformationArray = [
        '__sveltets_2_ensureAnimation(',
        getDirectiveNameStartEndIdx(str, attr),
        `(__sveltets_2_mapElementTag('${element.tagName}'),__sveltets_2_AnimationMove`
    ];
    if (attr.expression) {
        transformations.push(',(', [attr.expression.start, attr.expression.end], ')');
    }
    transformations.push('));');
    element.appendToStartEnd(transformations);
}
