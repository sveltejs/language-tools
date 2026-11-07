import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import {
    addDirectiveNameMapping,
    getDirectiveNameStartEndIdx,
    rangeWithTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { Element } from './Element';
import { getLeadingCommentTransformation } from './Comment';
import { getTrailingCommentTransformation } from './Comment';
import { SpanMapGenerator } from '../../utils/spanMap';

/**
 * transition|modifier:xxx(yyy)   --->   __sveltets_2_ensureTransition(xxx(svelte.mapElementTag('..'),(yyy)));
 */
export function handleTransitionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element,
    spanMapGenerator: SpanMapGenerator | undefined
): void {
    const trailingComments = getTrailingCommentTransformation(attr);
    const nameRange = getDirectiveNameStartEndIdx(str, attr);
    const mapElement = addDirectiveNameMapping(
        spanMapGenerator,
        nameRange,
        `${element.typingsNamespace}.mapElementTag('${element.tagName}')`
    );
    const transformations: TransformationArray = [
        ...getLeadingCommentTransformation(attr),
        '__sveltets_2_ensureTransition(',
        nameRange,
        `(${mapElement}`
    ];
    if (attr.expression) {
        transformations.push(
            ',(',
            rangeWithTrailingPropertyAccess(str.original, attr.expression),
            ')'
        );
    }
    transformations.push('));', ...trailingComments);
    element.appendToStartEnd(transformations);
}
