import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx, TransformationArray } from '../utils/node-utils';
import { Element } from './Element';

/**
 * use:xxx={params}   --->    __sveltets_2_ensureAction(xxx(svelte.mapElementTag('ParentNodeName'),(params)));
 */
export function handleActionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    const transformations: TransformationArray = [
        '__sveltets_2_ensureAction(',
        getDirectiveNameStartEndIdx(str, attr),
        `(${element.typingsNamespace}.mapElementTag('${element.tagName}')`
    ];
    if (attr.expression) {
        transformations.push(',(', [attr.expression.start, attr.expression.end], ')');
    }
    transformations.push('));');
    element.appendToStartEnd(transformations);
}
