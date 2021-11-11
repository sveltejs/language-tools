import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx } from '../utils/node-utils';
import { Element } from './Element';

/**
 * use:xxx={params}   --->    __sveltets_2_ensureAction(xxx(__sveltets_2_mapElementTag('ParentNodeName'),(params)));
 */
export function handleActionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    element.appendToStartEnd([
        '__sveltets_2_ensureAction(',
        getDirectiveNameStartEndIdx(str, attr),
        `(__sveltets_2_mapElementTag('${element.tagName}'),(`,
        attr.expression ? [attr.expression.start, attr.expression.end] : '{}',
        ')));'
    ]);
}
