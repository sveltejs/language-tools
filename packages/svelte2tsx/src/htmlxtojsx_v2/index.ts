import MagicString from 'magic-string';
import { walk } from 'svelte/compiler';
import { TemplateNode, Text } from 'svelte/types/compiler/interfaces';
import { Attribute, BaseNode, BaseDirective } from '../interfaces';
import { parseHtmlx } from '../utils/htmlxparser';
import { handleActionDirective } from './nodes/Action';
import { handleAnimateDirective } from './nodes/Animation';
import { handleAttribute } from './nodes/Attribute';
import { handleAwait } from './nodes/AwaitPendingCatchBlock';
import { handleBinding } from './nodes/Binding';
import { handleClassDirective } from './nodes/Class';
import { handleComment } from './nodes/Comment';
import { handleDebug } from './nodes/DebugTag';
import { handleEach } from './nodes/EachBlock';
import { Element } from './nodes/Element';
import { handleEventHandler } from './nodes/EventHandler';
import { handleElse, handleIf } from './nodes/IfElseBlock';
import { InlineComponent } from './nodes/InlineComponent';
import { handleKey } from './nodes/Key';
import { handleLet } from './nodes/Let';
import { handleMustacheTag } from './nodes/MustacheTag';
import { handleRawHtml } from './nodes/RawMustacheTag';
import { handleText } from './nodes/Text';
import { handleTransitionDirective } from './nodes/Transition';

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
    options: { preserveAttributeCase?: boolean; typingsNamespace?: 'html' | 'native' | 'any' } = {}
): void {
    const htmlx = str.original;
    options = { preserveAttributeCase: false, typingsNamespace: 'html', ...options };
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
                        handleEach(str, node);
                        break;
                    case 'ElseBlock':
                        handleElse(str, node, parent);
                        break;
                    case 'KeyBlock':
                        handleKey(str, node);
                        break;
                    case 'MustacheTag':
                        handleMustacheTag(str, node, parent);
                        break;
                    case 'RawMustacheTag':
                        handleRawHtml(str, node);
                        break;
                    case 'DebugTag':
                        handleDebug(str, node);
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
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Body':
                    case 'Slot':
                        if (node.name !== '!DOCTYPE') {
                            if (element) {
                                element.child = new Element(
                                    str,
                                    node,
                                    options.typingsNamespace,
                                    element
                                );
                                element = element.child;
                            } else {
                                element = new Element(str, node, options.typingsNamespace);
                            }
                        }
                        break;
                    case 'Comment':
                        handleComment(str, node);
                        break;
                    case 'Binding':
                        handleBinding(str, node as BaseDirective, parent, element);
                        break;
                    case 'Class':
                        handleClassDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Action':
                        handleActionDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Transition':
                        handleTransitionDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Animation':
                        handleAnimateDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Attribute':
                        handleAttribute(
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
                    case 'Let':
                        handleLet(str, node, parent, options.preserveAttributeCase, element);
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
                        handleAwait(str, node);
                        break;
                    case 'SlotTemplate':
                        break;
                    case 'InlineComponent':
                    case 'Element':
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Body':
                    case 'Slot':
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
    options?: {
        emitOnTemplateError?: boolean;
        preserveAttributeCase: boolean;
        typingsNamespace: 'html' | 'native' | 'any';
    }
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
