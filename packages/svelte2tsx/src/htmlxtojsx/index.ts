import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import svelte from 'svelte/compiler';
import { parseHtmlx } from '../utils/htmlxparser';
import { handleActionDirective } from './nodes/action-directive';
import { handleAnimateDirective } from './nodes/animation-directive';
import { handleAttribute } from './nodes/attribute';
import { handleAwait } from './nodes/await';
import { handleKey } from './nodes/key';
import { handleBinding } from './nodes/binding';
import { handleClassDirective } from './nodes/class-directive';
import { handleComment } from './nodes/comment';
import { handleComponent } from './nodes/component';
import { handleSlot, usesLet } from './nodes/slot';
import { handleDebug } from './nodes/debug';
import { handleEach } from './nodes/each';
import { handleElement } from './nodes/element';
import { handleEventHandler } from './nodes/event-handler';
import { handleElse, handleIf } from './nodes/if-else';
import { IfScope } from './nodes/if-scope';
import { handleRawHtml } from './nodes/raw-html';
import { handleSvelteTag } from './nodes/svelte-tag';
import { handleTransitionDirective } from './nodes/transition-directive';
import { handleText } from './nodes/text';
import TemplateScope from '../svelte2tsx/nodes/TemplateScope';
import { getSlotName, isDestructuringPatterns, isIdentifier } from '../utils/svelteAst';
import { extract_identifiers } from 'periscopic';
import { SvelteIdentifier } from '../interfaces';

type Walker = (node: Node, parent: Node, prop: string, index: number) => void;

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
    ast: Node,
    onWalk: Walker = null,
    onLeave: Walker = null
): void {
    const htmlx = str.original;
    stripDoctype(str);
    str.prepend('<>');
    str.append('</>');

    const templateScope = { value: new TemplateScope() };
    const handleScopeEach = (node: Node) => {
        templateScope.value = templateScope.value.child();
        if (node.context) {
            handleScope(node.context, node, templateScope.value);
        }
        if (node.index) {
            templateScope.value.add({ name: node.index, type: 'Identifier' }, node);
        }
    };
    const handleScopeAwait = (node: Node) => {
        templateScope.value = templateScope.value.child();
        if (node.value) {
            handleScope(node.value, node.then, templateScope.value);
        }
        if (node.error) {
            handleScope(node.error, node.catch, templateScope.value);
        }
    };

    let ifScope = new IfScope(templateScope);

    (svelte as any).walk(ast, {
        enter: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        handleIf(htmlx, str, node, ifScope);
                        ifScope = ifScope.getChild();
                        break;
                    case 'EachBlock':
                        handleScopeEach(node);
                        handleEach(htmlx, str, node, ifScope);
                        break;
                    case 'ElseBlock':
                        handleElse(htmlx, str, node, parent, ifScope);
                        break;
                    case 'AwaitBlock':
                        handleScopeAwait(node);
                        handleAwait(htmlx, str, node, ifScope);
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
                        if (usesLet(node)) {
                            templateScope.value = templateScope.value.child();
                        }
                        handleComponent(htmlx, str, node, parent, ifScope, templateScope.value);
                        break;
                    case 'Element':
                        if (usesLet(node)) {
                            templateScope.value = templateScope.value.child();
                        }
                        handleElement(htmlx, str, node, parent, ifScope, templateScope.value);
                        break;
                    case 'Comment':
                        handleComment(str, node);
                        break;
                    case 'Binding':
                        handleBinding(htmlx, str, node, parent);
                        break;
                    case 'Class':
                        handleClassDirective(str, node);
                        break;
                    case 'Action':
                        handleActionDirective(htmlx, str, node, parent);
                        break;
                    case 'Transition':
                        handleTransitionDirective(htmlx, str, node, parent);
                        break;
                    case 'Animation':
                        handleAnimateDirective(htmlx, str, node, parent);
                        break;
                    case 'Attribute':
                        handleAttribute(htmlx, str, node, parent);
                        break;
                    case 'EventHandler':
                        handleEventHandler(htmlx, str, node, parent);
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
                        handleSlot(
                            htmlx,
                            str,
                            node,
                            parent,
                            getSlotName(node) || 'default',
                            ifScope,
                            templateScope.value
                        );
                        break;
                    case 'Text':
                        handleText(str, node);
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

        leave: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        ifScope = ifScope.getParent();
                        break;
                    case 'EachBlock':
                    case 'AwaitBlock':
                        templateScope.value = templateScope.value.parent;
                        break;
                    case 'InlineComponent':
                    case 'Element':
                        if (usesLet(node)) {
                            templateScope.value = templateScope.value.parent;
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

function handleScope(identifierDef: Node, owner: Node, templateScope: TemplateScope) {
    if (isIdentifier(identifierDef)) {
        templateScope.add(identifierDef, owner);
    }
    if (isDestructuringPatterns(identifierDef)) {
        // the node object is returned as-it with no mutation
        const identifiers = extract_identifiers(identifierDef) as SvelteIdentifier[];
        templateScope.addMany(identifiers, owner);
    }
}

/**
 * @internal For testing only
 */
export function htmlx2jsx(htmlx: string, options?: { emitOnTemplateError?: boolean }) {
    const ast = parseHtmlx(htmlx, options);
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, ast);

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
