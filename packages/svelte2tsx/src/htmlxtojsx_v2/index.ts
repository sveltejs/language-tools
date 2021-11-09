import MagicString from 'magic-string';
import { walk } from 'svelte/compiler';
import { TemplateNode, Text } from 'svelte/types/compiler/interfaces';
import { Attribute, BaseNode, BaseDirective } from '../interfaces';
import { parseHtmlx } from '../utils/htmlxparser';
import { handleAttribute } from './nodes/Attribute';
import { handleComment } from './nodes/Comment';
import { Element } from './nodes/Element';
import { handleEventHandler } from './nodes/EventHandler';
import { handleElse, handleIf } from './nodes/IfElseBlock';
import { InlineComponent } from './nodes/InlineComponent';
import { handleText } from './nodes/Text';

type Walker = (node: TemplateNode, parent: BaseNode, prop: string, index: number) => void;

function stripDoctype(str: MagicString): void {
    const regex = /<!doctype(.+?)>(\n)?/i;
    const result = regex.exec(str.original);
    if (result) {
        str.remove(result.index, result.index + result[0].length);
    }
}

/**
 * Walks the HTMLx part of the Svelte component
 * and converts it to JSX
 */
export function convertHtmlxToJsx(
    str: MagicString,
    ast: TemplateNode,
    onWalk: Walker = null,
    onLeave: Walker = null,
    options: { preserveAttributeCase?: boolean; typings?: 'html' | 'any' } = {}
): void {
    const htmlx = str.original;
    options = { preserveAttributeCase: false, typings: 'html', ...options };
    htmlx;
    stripDoctype(str);

    let element: Element | InlineComponent | undefined;

    walk(ast, {
        enter: (node: TemplateNode, parent: BaseNode, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        handleIf(str, node);
                        break;
                    case 'EachBlock':
                        break;
                    case 'ElseBlock':
                        handleElse(str, node, parent);
                        break;
                    case 'AwaitBlock':
                        break;
                    case 'PendingBlock':
                        break;
                    case 'ThenBlock':
                        break;
                    case 'CatchBlock':
                        break;
                    case 'KeyBlock':
                        break;
                    case 'RawMustacheTag':
                        break;
                    case 'DebugTag':
                        break;
                    case 'InlineComponent':
                        if (element) {
                            element.child = new InlineComponent(str, node, element);
                            element = element.child;
                        } else {
                            element = new InlineComponent(str, node);
                        }
                        break;
                    case 'Element':
                        if (node.name !== '!DOCTYPE') {
                            if (element) {
                                element.child = new Element(str, node, options.typings, element);
                                element = element.child;
                            } else {
                                element = new Element(str, node, options.typings);
                            }
                        }
                        break;
                    case 'Comment':
                        handleComment(str, node);
                        break;
                    case 'Binding':
                        break;
                    case 'Class':
                        break;
                    case 'Action':
                        break;
                    case 'Transition':
                        break;
                    case 'Animation':
                        break;
                    case 'Attribute':
                        handleAttribute(
                            str.original,
                            str,
                            node as Attribute,
                            parent,
                            options.preserveAttributeCase,
                            element
                        );
                        break;
                    case 'EventHandler':
                        handleEventHandler(str, node as BaseDirective, element);
                        break;
                    case 'Options':
                        break;
                    case 'Window':
                        break;
                    case 'Head':
                        break;
                    case 'Body':
                        break;
                    case 'SlotTemplate':
                        break;
                    case 'Text':
                        handleText(str, node as Text, parent);
                        break;
                }
                if (onWalk) {
                    onWalk(node, parent, prop, index);
                }
            } catch (e) {
                console.error('Error walking node ', node, e);
                throw e;
            }
        },

        leave: (node: TemplateNode, parent: BaseNode, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        break;
                    case 'EachBlock':
                        break;
                    case 'AwaitBlock':
                        break;
                    case 'SlotTemplate':
                        break;
                    case 'InlineComponent':
                    case 'Element':
                        if (node.name !== '!DOCTYPE') {
                            element.performTransformation();
                            element = element.parent;
                        }
                        break;
                }
                if (onLeave) {
                    onLeave(node, parent, prop, index);
                }
            } catch (e) {
                console.error('Error leaving node ', node);
                throw e;
            }
        }
    });
}

/**
 * @internal For testing only
 */
export function htmlx2jsx(
    htmlx: string,
    options?: { emitOnTemplateError?: boolean; preserveAttributeCase: boolean }
) {
    const ast = parseHtmlx(htmlx, options).htmlxAst;
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, ast, null, null, options);
    console.log('after');

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
