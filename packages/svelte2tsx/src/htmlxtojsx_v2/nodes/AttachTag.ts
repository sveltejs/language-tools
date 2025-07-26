import { BaseNode } from '../../interfaces';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * {@attach xxx}   --->    [Symbol()]: xxx
 */
export function handleAttachTag(tag: BaseNode, element: Element | InlineComponent): void {
    // element.addAttachment(attr);
    if (element instanceof InlineComponent) {
        element.addProp(['[Symbol("@attach")]'], [[tag.expression.start, tag.expression.end]]);
    } else {
        element.addAttribute(['[Symbol("@attach")]'], [[tag.expression.start, tag.expression.end]]);
    }
}
