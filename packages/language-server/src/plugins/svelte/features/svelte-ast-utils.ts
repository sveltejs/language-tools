import { Node } from 'estree';
import { walk } from 'estree-walker';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';

export { type TemplateNode };

export interface SvelteNode {
    start: number;
    end: number;
    type: string;
    parent?: SvelteNode;
    [key: string]: any;
}

export interface AwaitBlock extends SvelteNode {
    type: 'AwaitBlock';
    expression: SvelteNode & Node;
    value: (SvelteNode & Node) | null;
    error: (SvelteNode & Node) | null;
    pending: AwaitSubBlock;
    then: AwaitSubBlock;
    catch: AwaitSubBlock;
}

export interface AwaitSubBlock extends SvelteNode {
    skip: boolean;
    children: SvelteNode[];
}

export interface EachBlock extends SvelteNode {
    type: 'EachBlock';
    expression: SvelteNode & Node;
    context: SvelteNode & Node;
    key?: SvelteNode & Node;
    else?: SvelteNode;
    children: SvelteNode[];
}

export function isElseBlockWithElseIf(node: SvelteNode | null | undefined) {
    return (
        !!node &&
        node.type === 'ElseBlock' &&
        'children' in node &&
        Array.isArray(node.children) &&
        node.children.length === 1 &&
        node.children[0].type === 'IfBlock'
    );
}

export function hasElseBlock(node: SvelteNode): node is SvelteNode & { else: SvelteNode } {
    return 'else' in node && !!node.else;
}

export function findElseBlockTagStart(documentText: string, elseBlock: SvelteNode) {
    return documentText.lastIndexOf('{', documentText.lastIndexOf(':else', elseBlock.start));
}

export function findIfBlockEndTagStart(documentText: string, ifBlock: SvelteNode) {
    return documentText.lastIndexOf('{', documentText.lastIndexOf('/if', ifBlock.end));
}

type ESTreeWaker = Parameters<typeof walk>[1];
type ESTreeEnterFunc = NonNullable<ESTreeWaker['enter']>;
type ESTreeLeaveFunc = NonNullable<ESTreeWaker['leave']>;

export interface SvelteNodeWalker {
    enter?: (
        this: {
            skip: () => void;
            remove: () => void;
            replace: (node: SvelteNode) => void;
        },
        node: SvelteNode,
        parent: SvelteNode,
        key: Parameters<ESTreeEnterFunc>[2],
        index: Parameters<ESTreeEnterFunc>[3]
    ) => void;
    leave?: (
        this: {
            skip: () => void;
            remove: () => void;
            replace: (node: SvelteNode) => void;
        },
        node: SvelteNode,
        parent: SvelteNode,
        key: Parameters<ESTreeLeaveFunc>[2],
        index: Parameters<ESTreeLeaveFunc>[3]
    ) => void;
}

// wrap the estree-walker to make it svelte specific
// the type casting is necessary because estree-walker is not designed for this
// especially in v3 which svelte 4 uses
export function walkSvelteAst(htmlAst: TemplateNode, walker: SvelteNodeWalker) {
    walk(htmlAst as any, {
        enter(node, parent, key, index) {
            walker.enter?.call(this as any, node as SvelteNode, parent as SvelteNode, key, index);
        },
        leave(node, parent, key, index) {
            walker.leave?.call(this as any, node as SvelteNode, parent as SvelteNode, key, index);
        }
    });
}

export function isAwaitBlock(node: SvelteNode): node is AwaitBlock {
    return node.type === 'AwaitBlock';
}

export function isEachBlock(node: SvelteNode): node is EachBlock {
    return node.type === 'EachBlock';
}
