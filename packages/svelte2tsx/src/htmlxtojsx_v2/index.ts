import MagicString from 'magic-string';
import { walk } from 'estree-walker';
// @ts-ignore
import { TemplateNode, Text } from 'svelte/types/compiler/interfaces';
import { Attribute, BaseNode, BaseDirective, StyleDirective, ConstTag } from '../interfaces';
import { parseHtmlx } from '../utils/htmlxparser';
import { handleActionDirective } from './nodes/Action';
import { handleAnimateDirective } from './nodes/Animation';
import { handleAttribute } from './nodes/Attribute';
import { handleAwait } from './nodes/AwaitPendingCatchBlock';
import { handleBinding } from './nodes/Binding';
import { handleClassDirective } from './nodes/Class';
import { handleComment } from './nodes/Comment';
import { handleConstTag } from './nodes/ConstTag';
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
import { handleSpread } from './nodes/Spread';
import { handleStyleDirective } from './nodes/StyleDirective';
import { handleText } from './nodes/Text';
import { handleTransitionDirective } from './nodes/Transition';
import { handleImplicitChildren, handleSnippet, hoistSnippetBlock } from './nodes/SnippetBlock';
import { handleRenderTag } from './nodes/RenderTag';

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
    options: {
        svelte5Plus: boolean;
        preserveAttributeCase?: boolean;
        typingsNamespace?: string;
    } = { svelte5Plus: false }
) {
    const htmlx = str.original;
    options = { preserveAttributeCase: false, ...options };
    options.typingsNamespace = options.typingsNamespace || 'svelteHTML';
    htmlx;
    stripDoctype(str);

    const rootSnippets: Array<[number, number]> = [];
    let element: Element | InlineComponent | undefined;

    const pendingSnippetHoistCheck = new Set<BaseNode>();

    walk(ast as any, {
        enter: (estreeTypedNode, estreeTypedParent, prop: string, index: number) => {
            const node = estreeTypedNode as TemplateNode;
            const parent = estreeTypedParent as BaseNode;

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
                    case 'SnippetBlock':
                        handleSnippet(
                            str,
                            node,
                            element instanceof InlineComponent &&
                                estreeTypedParent.type === 'InlineComponent'
                                ? element
                                : undefined
                        );
                        if (parent === ast) {
                            // root snippet -> move to instance script
                            rootSnippets.push([node.start, node.end]);
                        } else {
                            pendingSnippetHoistCheck.add(parent);
                        }
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
                    case 'ConstTag':
                        handleConstTag(str, node as ConstTag);
                        break;
                    case 'RenderTag':
                        handleRenderTag(str, node);
                        break;
                    case 'InlineComponent':
                        if (element) {
                            element.child = new InlineComponent(str, node, element);
                            element = element.child;
                        } else {
                            element = new InlineComponent(str, node);
                        }
                        if (options.svelte5Plus) {
                            handleImplicitChildren(node, element as InlineComponent);
                        }
                        break;
                    case 'Element':
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Title':
                    case 'Document':
                    case 'Body':
                    case 'Slot':
                    case 'SlotTemplate':
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
                        handleBinding(
                            str,
                            node as BaseDirective,
                            parent,
                            element,
                            options.typingsNamespace === 'svelteHTML',
                            options.svelte5Plus
                        );
                        break;
                    case 'Class':
                        handleClassDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'StyleDirective':
                        handleStyleDirective(str, node as StyleDirective, element as Element);
                        break;
                    case 'Action':
                        handleActionDirective(node as BaseDirective, element as Element);
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
                            options.svelte5Plus,
                            element
                        );
                        break;
                    case 'Spread':
                        handleSpread(node, element);
                        break;
                    case 'EventHandler':
                        handleEventHandler(str, node as BaseDirective, element);
                        break;
                    case 'Let':
                        handleLet(
                            str,
                            node,
                            parent,
                            options.preserveAttributeCase,
                            options.svelte5Plus,
                            element
                        );
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

        leave: (estreeTypedNode, estreeTypedParent, prop: string, index: number) => {
            const node = estreeTypedNode as TemplateNode;
            const parent = estreeTypedParent as BaseNode;

            try {
                switch (node.type) {
                    case 'IfBlock':
                        break;
                    case 'EachBlock':
                        break;
                    case 'AwaitBlock':
                        handleAwait(str, node);
                        break;
                    case 'InlineComponent':
                    case 'Element':
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Title':
                    case 'Body':
                    case 'Document':
                    case 'Slot':
                    case 'SlotTemplate':
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

    for (const node of pendingSnippetHoistCheck) {
        hoistSnippetBlock(str, node);
    }

    return rootSnippets;
}

/**
 * @internal For testing only
 */
export function htmlx2jsx(
    htmlx: string,
    parse: typeof import('svelte/compiler').parse,
    options?: {
        emitOnTemplateError?: boolean;
        preserveAttributeCase: boolean;
        typingsNamespace: string;
        svelte5Plus: boolean;
    }
) {
    const ast = parseHtmlx(htmlx, parse, { ...options }).htmlxAst;
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, ast, null, null, options);

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
