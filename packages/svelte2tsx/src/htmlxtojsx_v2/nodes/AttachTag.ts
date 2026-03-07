import { BaseNode } from '../../interfaces';
import { TransformationArray } from '../utils/node-utils';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';
import { getLeadingCommentTransformation, getTrailingCommentTransformation } from './Comment';

/**
 * {@attach xxx}   --->    [Symbol()]: xxx
 */
export function handleAttachTag(tag: BaseNode, element: Element | InlineComponent): void {
    const transformation = [...getLeadingCommentTransformation(tag), '[Symbol("@attach")]'];
    const value: TransformationArray = [
        [tag.expression.start, tag.expression.end],
        ...getTrailingCommentTransformation(tag)
    ];
    // element.addAttachment(attr);
    if (element instanceof InlineComponent) {
        element.addProp(transformation, value);
    } else {
        element.addAttribute(transformation, value);
    }
}
