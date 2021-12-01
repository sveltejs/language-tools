import { BaseDirective } from '../../interfaces';
import { Element } from './Element';

/**
 * class:xx={yyy}   --->   yyy;
 */
export function handleClassDirective(attr: BaseDirective, element: Element): void {
    element.appendToStartEnd([[attr.expression.start, attr.expression.end], ';']);
}
