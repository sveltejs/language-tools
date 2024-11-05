import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { TransformationArray } from '../utils/node-utils';
import { handleAttribute } from './Attribute';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';

/**
 * `let:foo={bar}`  -->  `foo:bar`, which becomes `const {foo:bar} = $$_parent.$$slotDef['slotName'];`
 * @param node
 * @param element
 */
export function handleLet(
    str: MagicString,
    node: BaseNode,
    parent: BaseNode,
    preserveCase: boolean,
    svelte5Plus: boolean,
    element: Element | InlineComponent
): void {
    if (element instanceof InlineComponent) {
        // let:xx belongs to either the default slot or a named slot,
        // which is determined in Attribute.ts
        addSlotLet(node, element);
    } else {
        if (element.parent instanceof InlineComponent) {
            // let:xx is on a HTML element and belongs to a (named slot of a parent component
            addSlotLet(node, element);
        } else {
            // let:xx is a regular HTML attribute (probably a mistake by the user)
            handleAttribute(
                str,
                {
                    start: node.start,
                    end: node.end,
                    type: 'Attribute',
                    name: 'let:' + node.name,
                    value: node.expression
                        ? [
                              {
                                  type: 'MustacheTag',
                                  start: node.expression.start,
                                  end: node.expression.end,
                                  expression: node.expression
                              }
                          ]
                        : true
                },
                parent,
                preserveCase,
                svelte5Plus,
                element
            );
        }
    }
}

function addSlotLet(node: BaseNode, element: Element | InlineComponent) {
    const letTransformation: TransformationArray = [
        [node.start + 'let:'.length, node.start + 'let:'.length + node.name.length]
    ];
    if (node.expression) {
        letTransformation.push(':', [node.expression.start, node.expression.end]);
    }
    element.addSlotLet(letTransformation);
}
