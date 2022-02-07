import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getNodeRangeIncludingTrailingPropertyAccess } from '../utils/node-utils';
import { Element } from './Element';

/**
 * class:xx={yyy}   --->   yyy;
 */
export function handleClassDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    element.appendToStartEnd([
        getNodeRangeIncludingTrailingPropertyAccess(str.original, attr.expression),
        ';'
    ]);
}
