import MagicString from 'magic-string';
import { walk } from 'svelte/compiler';
import { TemplateNode, Text } from 'svelte/types/compiler/interfaces';
import { Attribute, BaseDirective, BaseNode } from '../interfaces';
import { parseHtmlx } from '../utils/htmlxparser';
import { getSlotName } from '../utils/svelteAst';
import { handleActionDirective } from './nodes/action-directive';
import { handleAnimateDirective } from './nodes/animation-directive';
import { handleAttribute } from './nodes/attribute';
import { handleAwait, handleAwaitCatch, handleAwaitPending, handleAwaitThen } from './nodes/await';
import { handleBinding } from './nodes/binding';
import { handleClassDirective } from './nodes/class-directive';
import { handleComment } from './nodes/comment';
import { handleComponent } from './nodes/component';
import { handleDebug } from './nodes/debug';
import { handleEach } from './nodes/each';
import { handleElement } from './nodes/element';
import { handleEventHandler } from './nodes/event-handler';
import { handleElse, handleIf } from './nodes/if-else';
import { IfScope } from './nodes/if-scope';
import { handleKey } from './nodes/key';
import { handleRawHtml } from './nodes/raw-html';
import { handleSlot } from './nodes/slot';
import { handleSvelteTag } from './nodes/svelte-tag';
import { TemplateScopeManager } from './nodes/template-scope';
import { handleText } from './nodes/text';
import { handleTransitionDirective } from './nodes/transition-directive';
import { usesLet } from './utils/node-utils';

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
    options: { preserveAttributeCase?: boolean } = {}
): void {
    const htmlx = str.original;
    stripDoctype(str);
    str.prepend('<>');
    str.append('</>');

    const templateScopeManager = new TemplateScopeManager();

    let ifScope = new IfScope(templateScopeManager);

    walk(ast, {
        enter: (node: TemplateNode, parent: BaseNode, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        handleIf(htmlx, str, node, ifScope);
                        if (!node.elseif) {
                            ifScope = ifScope.getChild();
                        }
                        break;
                    case 'EachBlock':
                        templateScopeManager.eachEnter(node);
                        handleEach(htmlx, str, node, ifScope);
                        break;
                    case 'ElseBlock':
                        templateScopeManager.elseEnter(parent);
                        handleElse(htmlx, str, node, parent, ifScope);
                        break;
                    case 'AwaitBlock':
                        handleAwait(htmlx, str, node, ifScope, templateScopeManager);
                        break;
                    case 'PendingBlock':
                        templateScopeManager.awaitPendingEnter(node, parent);
                        handleAwaitPending(parent, htmlx, str, ifScope);
                        break;
                    case 'ThenBlock':
                        templateScopeManager.awaitThenEnter(node, parent);
                        handleAwaitThen(parent, htmlx, str, ifScope);
                        break;
                    case 'CatchBlock':
                        templateScopeManager.awaitCatchEnter(node, parent);
                        handleAwaitCatch(parent, htmlx, str, ifScope);
                        break;
                    case 'KeyBlock':
                        handleKey(htmlx, str, node);
                        break;
                    case 'RawMustacheTag':
                        handleRawHtml(htmlx, str, node);
                        break;
                    case 'DebugTag':
                        handleDebug(htmlx, str, node);
                        break;
                    case 'InlineComponent':
                        templateScopeManager.componentOrSlotTemplateOrElementEnter(node);
                        handleComponent(
                            htmlx,
                            str,
                            node,
                            parent,
                            ifScope,
                            templateScopeManager.value
                        );
                        break;
                    case 'Element':
                        templateScopeManager.componentOrSlotTemplateOrElementEnter(node);
                        handleElement(
                            htmlx,
                            str,
                            node,
                            parent,
                            ifScope,
                            templateScopeManager.value
                        );
                        break;
                    case 'Comment':
                        handleComment(str, node);
                        break;
                    case 'Binding':
                        handleBinding(htmlx, str, node as BaseDirective, parent);
                        break;
                    case 'Class':
                        handleClassDirective(str, node as BaseDirective);
                        break;
                    case 'Action':
                        handleActionDirective(htmlx, str, node as BaseDirective, parent);
                        break;
                    case 'Transition':
                        handleTransitionDirective(htmlx, str, node as BaseDirective, parent);
                        break;
                    case 'Animation':
                        handleAnimateDirective(htmlx, str, node as BaseDirective, parent);
                        break;
                    case 'Attribute':
                        handleAttribute(
                            htmlx,
                            str,
                            node as Attribute,
                            parent,
                            options.preserveAttributeCase
                        );
                        break;
                    case 'EventHandler':
                        handleEventHandler(htmlx, str, node as BaseDirective, parent);
                        break;
                    case 'Options':
                        handleSvelteTag(htmlx, str, node);
                        break;
                    case 'Window':
                        handleSvelteTag(htmlx, str, node);
                        break;
                    case 'Head':
                        handleSvelteTag(htmlx, str, node);
                        break;
                    case 'Body':
                        handleSvelteTag(htmlx, str, node);
                        break;
                    case 'SlotTemplate':
                        handleSvelteTag(htmlx, str, node);
                        templateScopeManager.componentOrSlotTemplateOrElementEnter(node);
                        if (usesLet(node)) {
                            handleSlot(
                                htmlx,
                                str,
                                node,
                                parent,
                                getSlotName(node) || 'default',
                                ifScope,
                                templateScopeManager.value
                            );
                        }
                        break;
                    case 'Text':
                        handleText(str, node as Text);
                        break;
                }
                if (onWalk) {
                    onWalk(node, parent, prop, index);
                }
            } catch (e) {
                console.error('Error walking node ', node);
                throw e;
            }
        },

        leave: (node: TemplateNode, parent: BaseNode, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        if (!node.elseif) {
                            ifScope = ifScope.getParent();
                        }
                        break;
                    case 'EachBlock':
                        templateScopeManager.eachLeave(node);
                        break;
                    case 'AwaitBlock':
                        templateScopeManager.awaitLeave();
                        break;
                    case 'InlineComponent':
                    case 'Element':
                    case 'SlotTemplate':
                        templateScopeManager.componentOrSlotTemplateOrElementLeave(node);
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

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
