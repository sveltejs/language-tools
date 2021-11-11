import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { getDirectiveNameStartEndIdx } from '../utils/node-utils';
import { Element } from './Element';

/**
 * class:xx={yyy}   --->   __sveltets_1_ensureType(Boolean, !!(yyy));
 */
export function handleClassDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    element.appendToStartEnd([
        '__sveltets_2_ensureType(Boolean, !!(',
        getDirectiveNameStartEndIdx(str, attr),
        '));'
    ]);
}
