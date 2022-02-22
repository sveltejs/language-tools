import { BaseNode } from '../../interfaces';
import { TransformationArray } from '../utils/node-utils';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * Handle spreaded attributes/props on elements/components by removing the braces.
 * That way they can be added as a regular object spread.
 * `{...xx}` -> `...x`
 */
export function handleSpread(node: BaseNode, element: Element | InlineComponent) {
    const transformation: TransformationArray = [[node.start + 1, node.end - 1]];
    if (element instanceof Element) {
        element.addAttribute(transformation);
    } else {
        element.addProp(transformation);
    }
}
