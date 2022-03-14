import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { rangeWithTrailingPropertyAccess } from '../utils/node-utils';
import { Element } from './Element';

/**
 * class:xx={yyy}   --->   yyy;
 */
export function handleClassDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element
): void {
    element.appendToStartEnd([rangeWithTrailingPropertyAccess(str.original, attr.expression), ';']);
}
