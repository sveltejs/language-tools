import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import {
    getDirectiveNameStartEndIdx,
    getNodeRangeIncludingTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { Element } from './Element';

/**
 * transition|modifier:xxx(yyy)   --->   __sveltets_2_ensureTransition(xxx(svelte.mapElementTag('..'),(yyy)));
 */
export function handleTransitionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const transformations: TransformationArray = [
        '__sveltets_2_ensureTransition(',
        getDirectiveNameStartEndIdx(str, attr),
        `(${element.typingsNamespace}.mapElementTag('${element.tagName}')`
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
