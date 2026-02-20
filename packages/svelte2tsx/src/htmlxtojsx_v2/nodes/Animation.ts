import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import {
    getDirectiveNameStartEndIdx,
    rangeWithTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { Element } from './Element';
import { getLeadingCommentTransformation } from './Comment';
import { getTrailingCommentTransformation } from './Comment';

/**
 * animate:xxx(yyy)   --->   __sveltets_2_ensureAnimation(xxx(svelte.mapElementTag('..'),__sveltets_2_AnimationMove,(yyy)));
 */
export function handleAnimateDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const trailingComments = getTrailingCommentTransformation(attr);
    const transformations: TransformationArray = [
        ...getLeadingCommentTransformation(attr),
        '__sveltets_2_ensureAnimation(',
        getDirectiveNameStartEndIdx(str, attr),
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
