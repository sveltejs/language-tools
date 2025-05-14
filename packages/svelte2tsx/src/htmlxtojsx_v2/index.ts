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
import { ComponentDocumentation } from '../svelte2tsx/nodes/ComponentDocumentation';
import { ScopeStack } from '../svelte2tsx/utils/Scope';
import { Stores } from '../svelte2tsx/nodes/Stores';
import { Scripts } from '../svelte2tsx/nodes/Scripts';
import { SlotHandler } from '../svelte2tsx/nodes/slot';
import TemplateScope from '../svelte2tsx/nodes/TemplateScope';
import {
    handleScopeAndResolveForSlot,
    handleScopeAndResolveLetVarForSlot
} from '../svelte2tsx/nodes/handleScopeAndResolveForSlot';
import { EventHandler } from '../svelte2tsx/nodes/event-handler';
import { ComponentEvents } from '../svelte2tsx/nodes/ComponentEvents';
import { analyze } from 'periscopic';
import { handleAttachTag } from './nodes/AttachTag';

export interface TemplateProcessResult {
    /**
     * The HTML part of the Svelte AST.
     */
    htmlAst: TemplateNode;
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    slots: Map<string, Map<string, string>>;
    scriptTag: BaseNode;
    moduleScriptTag: BaseNode;
    /** Start/end positions of snippets that should be moved to the instance script or possibly even module script */
    rootSnippets: Array<[start: number, end: number, globals: Map<string, any>, string]>;
    /** To be added later as a comment on the default class export */
    componentDocumentation: ComponentDocumentation;
    events: ComponentEvents;
    resolvedStores: string[];
    usesAccessors: boolean;
    isRunes: boolean;
}

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
    tags: BaseNode[],
    options: {
        emitOnTemplateError?: boolean;
        namespace?: string;
        accessors?: boolean;
        mode?: 'ts' | 'dts';
        typingsNamespace?: string;
        svelte5Plus: boolean;
    } = { svelte5Plus: false }
): TemplateProcessResult {
    options.typingsNamespace = options.typingsNamespace || 'svelteHTML';
    const preserveAttributeCase = options.namespace === 'foreign';

    stripDoctype(str);

    const rootSnippets: Array<[number, number, Map<string, any>, string]> = [];
    let element: Element | InlineComponent | undefined;

    const pendingSnippetHoistCheck = new Set<BaseNode>();

    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;
    let usesAccessors = !!options.accessors;
    let isRunes = false;

    const componentDocumentation = new ComponentDocumentation();

    //track if we are in a declaration scope
    const isDeclaration = { value: false };

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const scopeStack = new ScopeStack();
    const stores = new Stores(scopeStack, isDeclaration);
    const scripts = new Scripts(ast);

    const handleSvelteOptions = (node: BaseNode) => {
        for (let i = 0; i < node.attributes.length; i++) {
            const optionName = node.attributes[i].name;
            const optionValue = node.attributes[i].value;

            switch (optionName) {
                case 'accessors':
                    if (Array.isArray(optionValue)) {
                        if (optionValue[0].type === 'MustacheTag') {
                            usesAccessors = optionValue[0].expression.value;
                        }
                    } else {
                        usesAccessors = true;
                    }
                    break;
                case 'runes':
                    isRunes = true;
                    break;
            }
        }
    };

    const handleIdentifier = (node: BaseNode) => {
        if (node.name === '$$props') {
            uses$$props = true;
            return;
        }
        if (node.name === '$$restProps') {
            uses$$restProps = true;
            return;
        }

        if (node.name === '$$slots') {
            uses$$slots = true;
            return;
        }
    };

    const handleStyleTag = (node: BaseNode) => {
        str.remove(node.start, node.end);
    };

    const slotHandler = new SlotHandler(str.original);
    let templateScope = new TemplateScope();

    const handleComponentLet = (component: BaseNode) => {
        templateScope = templateScope.child();
        const lets = slotHandler.getSlotConsumerOfComponent(component);

        for (const { letNode, slotName } of lets) {
            handleScopeAndResolveLetVarForSlot({
                letNode,
                slotName,
                slotHandler,
                templateScope,
                component
            });
        }
    };

    const handleScopeAndResolveForSlotInner = (
        identifierDef: BaseNode,
        initExpression: BaseNode,
        owner: BaseNode
    ) => {
        handleScopeAndResolveForSlot({
            identifierDef,
            initExpression,
            slotHandler,
            templateScope,
            owner
        });
    };

    const eventHandler = new EventHandler();

    walk(ast as any, {
        enter: (estreeTypedNode, estreeTypedParent, prop: string) => {
            const node = estreeTypedNode as TemplateNode;
            const parent = estreeTypedParent as BaseNode;

            if (
                prop == 'params' &&
                (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
            ) {
                isDeclaration.value = true;
            }
            if (prop == 'id' && parent.type == 'VariableDeclarator') {
                isDeclaration.value = true;
            }

            try {
                switch (node.type) {
                    case 'Identifier':
                        handleIdentifier(node);
                        stores.handleIdentifier(node, parent, prop);
                        eventHandler.handleIdentifier(node, parent, prop);
                        break;
                    case 'IfBlock':
                        handleIf(str, node);
                        break;
                    case 'EachBlock':
                        templateScope = templateScope.child();

                        if (node.context) {
                            handleScopeAndResolveForSlotInner(node.context, node.expression, node);
                        }
                        handleEach(str, node);
                        break;
                    case 'ElseBlock':
                        handleElse(str, node, parent);
                        break;
                    case 'KeyBlock':
                        handleKey(str, node);
                        break;
                    case 'BlockStatement':
                    case 'FunctionDeclaration':
                    case 'ArrowFunctionExpression':
                        scopeStack.push();
                        break;
                    case 'SnippetBlock':
                        scopeStack.push();
                        handleSnippet(
                            str,
                            node,
                            (element instanceof InlineComponent &&
                                estreeTypedParent.type === 'InlineComponent') ||
                                (element instanceof Element &&
                                    element.tagName === 'svelte:boundary')
                                ? element
                                : undefined
                        );
                        if (parent === ast) {
                            // root snippet -> move to instance script or possibly even module script
                            const result = analyze({
                                type: 'FunctionDeclaration',
                                start: -1,
                                end: -1,
                                id: node.expression,
                                params: node.parameters ?? [],
                                body: {
                                    type: 'BlockStatement',
                                    start: -1,
                                    end: -1,
                                    body: node.children as any[] // wrong AST, but periscopic doesn't care
                                }
                            });

                            rootSnippets.push([
                                node.start,
                                node.end,
                                result.globals,
                                node.expression.name
                            ]);
                        } else {
                            pendingSnippetHoistCheck.add(parent);
                        }
                        break;
                    case 'MustacheTag':
                        handleMustacheTag(str, node, parent);
                        break;
                    case 'RawMustacheTag':
                        scripts.checkIfContainsScriptTag(node);
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
                    case 'AttachTag':
                        handleAttachTag(node, element);
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
                        handleComponentLet(node);
                        break;
                    case 'Element':
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Title':
                    case 'Document':
                    case 'Body':
                    case 'SvelteHTML':
                    case 'SvelteBoundary':
                    case 'Slot':
                    case 'SlotTemplate':
                        if (node.type === 'Element') {
                            scripts.checkIfElementIsScriptTag(node, parent);
                        } else if (node.type === 'Options') {
                            handleSvelteOptions(node);
                        } else if (node.type === 'Slot') {
                            slotHandler.handleSlot(node, templateScope);
                        }

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
                        componentDocumentation.handleComment(node);
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
                        stores.handleDirective(node, str);
                        handleActionDirective(node as BaseDirective, element as Element);
                        break;
                    case 'Transition':
                        stores.handleDirective(node, str);
                        handleTransitionDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Animation':
                        stores.handleDirective(node, str);
                        handleAnimateDirective(str, node as BaseDirective, element as Element);
                        break;
                    case 'Attribute':
                        handleAttribute(
                            str,
                            node as Attribute,
                            parent,
                            preserveAttributeCase,
                            options.svelte5Plus,
                            element
                        );
                        break;
                    case 'Spread':
                        handleSpread(node, element);
                        break;
                    case 'EventHandler':
                        eventHandler.handleEventHandler(node, parent);
                        handleEventHandler(str, node as BaseDirective, element);
                        break;
                    case 'Let':
                        handleLet(
                            str,
                            node,
                            parent,
                            preserveAttributeCase,
                            options.svelte5Plus,
                            element
                        );
                        break;
                    case 'Text':
                        handleText(str, node as Text, parent);
                        break;
                    case 'Style':
                        handleStyleTag(node);
                        break;
                    case 'VariableDeclarator':
                        isDeclaration.value = true;
                        break;
                    case 'AwaitBlock':
                        templateScope = templateScope.child();
                        if (node.value) {
                            handleScopeAndResolveForSlotInner(
                                node.value,
                                node.expression,
                                node.then
                            );
                        }
                        if (node.error) {
                            handleScopeAndResolveForSlotInner(
                                node.error,
                                node.expression,
                                node.catch
                            );
                        }
                        break;
                }
            } catch (e) {
                console.error('Error walking node ', node, e);
                throw e;
            }
        },

        leave: (estreeTypedNode, estreeTypedParent, prop: string) => {
            const node = estreeTypedNode as TemplateNode;
            const parent = estreeTypedParent as BaseNode;

            if (
                prop == 'params' &&
                (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
            ) {
                isDeclaration.value = false;
            }

            if (prop == 'id' && parent.type == 'VariableDeclarator') {
                isDeclaration.value = false;
            }
            const onTemplateScopeLeave = () => {
                templateScope = templateScope.parent;
            };

            try {
                switch (node.type) {
                    case 'BlockStatement':
                    case 'FunctionDeclaration':
                    case 'ArrowFunctionExpression':
                    case 'SnippetBlock':
                        scopeStack.pop();
                        break;
                    case 'EachBlock':
                        onTemplateScopeLeave();
                        break;
                    case 'AwaitBlock':
                        onTemplateScopeLeave();
                        handleAwait(str, node);
                        break;
                    case 'InlineComponent':
                    case 'Element':
                    case 'Options':
                    case 'Window':
                    case 'Head':
                    case 'Title':
                    case 'Body':
                    case 'SvelteHTML':
                    case 'SvelteBoundary':
                    case 'Document':
                    case 'Slot':
                    case 'SlotTemplate':
                        if (node.type === 'InlineComponent') {
                            onTemplateScopeLeave();
                        }
                        if (node.name !== '!DOCTYPE') {
                            element.performTransformation();
                            element = element.parent;
                        }
                        break;
                }
            } catch (e) {
                console.error('Error leaving node ', node);
                throw e;
            }
        }
    });

    // hoist inner snippets to top of containing element
    for (const node of pendingSnippetHoistCheck) {
        hoistSnippetBlock(str, node);
    }

    // resolve scripts
    const { scriptTag, moduleScriptTag } = scripts.getTopLevelScriptTags();
    if (options.mode !== 'ts') {
        scripts.blankOtherScriptTags(str);
    }

    //resolve stores
    const resolvedStores = stores.getStoreNames();

    return {
        htmlAst: ast,
        moduleScriptTag,
        scriptTag,
        rootSnippets,
        slots: slotHandler.getSlotDef(),
        events: new ComponentEvents(
            eventHandler,
            tags.some((tag) => tag.attributes?.some((a) => a.name === 'strictEvents')),
            str
        ),
        uses$$props,
        uses$$restProps,
        uses$$slots,
        componentDocumentation,
        resolvedStores,
        usesAccessors,
        isRunes
    };
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
    const { htmlxAst, tags } = parseHtmlx(htmlx, parse, { ...options });
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, htmlxAst, tags, {
        ...options,
        namespace: options?.preserveAttributeCase ? 'foreign' : undefined
    });

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
