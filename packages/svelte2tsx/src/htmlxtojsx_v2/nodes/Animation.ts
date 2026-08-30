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
 * animate:xxx(yyy)   --->   __sveltets_2_ensureAnimation(xxx(svelte.mapElementTag('..'),__sveltets_2_AnimationMove,(yyy)));
 */
export function handleAnimateDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element,
    spanMapGenerator: SpanMapGenerator | undefined
): void {
    const trailingComments = getTrailingCommentTransformation(attr);
    const nameRange = getDirectiveNameStartEndIdx(str, attr);
    addDirectiveNameMapping(spanMapGenerator, nameRange);
    const transformations: TransformationArray = [
        ...getLeadingCommentTransformation(attr),
        '__sveltets_2_ensureAnimation(',
        nameRange,
        `(${element.typingsNamespace}.mapElementTag('${element.tagName}'),__sveltets_2_AnimationMove`
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
