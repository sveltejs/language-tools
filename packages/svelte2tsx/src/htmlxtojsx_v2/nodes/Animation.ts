import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import {
    getDirectiveNameStartEndIdx,
    getNodeRangeIncludingTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { Element } from './Element';

/**
 * animate:xxx(yyy)   --->   __sveltets_2_ensureAnimation(xxx(svelte.mapElementTag('..'),__sveltets_2_AnimationMove,(yyy)));
 */
export function handleAnimateDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const transformations: TransformationArray = [
        '__sveltets_2_ensureAnimation(',
        getDirectiveNameStartEndIdx(str, attr),
        `(${element.typingsNamespace}.mapElementTag('${element.tagName}'),__sveltets_2_AnimationMove`
    ];
    if (attr.expression) {
        transformations.push(
            ',(',
            getNodeRangeIncludingTrailingPropertyAccess(str.original, attr.expression),
            ')'
        );
    }
    transformations.push('));');
    element.appendToStartEnd(transformations);
}
