import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import * as svelte from 'svelte/compiler';
import { parseHtmlx } from '../utils/htmlxparser';
import { handleActionDirective } from './nodes/action-directive';
import { handleAnimateDirective } from './nodes/animation-directive';
import { handleAttribute } from './nodes/attribute';
import { handleAwait } from './nodes/await';
import { handleBinding } from './nodes/binding';
import { handleClassDirective } from './nodes/class-directive';
import { handleComment } from './nodes/comment';
import { handleComponent } from './nodes/component';
import { handleDebug } from './nodes/debug';
import { handleEach } from './nodes/each';
import { handleElement } from './nodes/element';
import { handleEventHandler } from './nodes/event-handler';
import { handleElse, handleIf } from './nodes/if-else';
import { handleKey } from './nodes/key';
import { handleRawHtml } from './nodes/raw-html';
import { handleSvelteTag } from './nodes/svelte-tag';
import { handleTransitionDirective } from './nodes/transition-directive';

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

    (svelte as any).walk(ast, {
        enter: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case 'IfBlock':
                        handleIf(htmlx, str, node);
                        break;
                    case 'EachBlock':
                        handleEach(htmlx, str, node);
                        break;
                    case 'ElseBlock':
                        handleElse(htmlx, str, node, parent);
                        break;
                    case 'AwaitBlock':
                        handleAwait(htmlx, str, node);
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
                        handleComponent(htmlx, str, node);
                        break;
                    case 'Element':
                        handleElement(htmlx, str, node);
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
                        handleTransitionDirective(htmlx, str, node);
                        break;
                    case 'Animation':
                        handleAnimateDirective(htmlx, str, node);
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
export function htmlx2jsx(htmlx: string) {
    const ast = parseHtmlx(htmlx);
    const str = new MagicString(htmlx);

    convertHtmlxToJsx(str, ast);

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString()
    };
}
