import { ArrayPattern, Identifier, ObjectPattern, Node } from 'estree';
import { DirectiveType, TemplateNode } from 'svelte/types/compiler/interfaces';

export interface NodeRange {
    start: number;
    end: number;
}

export interface SvelteIdentifier extends Identifier, NodeRange {}

export interface SvelteArrayPattern extends ArrayPattern, NodeRange {}

export interface SvelteObjectPattern extends ObjectPattern, NodeRange {}

export interface WithName {
    type: string;
    name: string;
}

// Copied from the Svelte type definitions
export interface BaseNode {
    start: number;
    end: number;
    type: string;
    children?: TemplateNode[];
    [prop_name: string]: any;
}

export interface BaseDirective extends BaseNode {
    type: DirectiveType;
    expression: null | Node;
    name: string;
    modifiers: string[];
}

export interface Attribute extends BaseNode {
    value: BaseNode[] | true;
}
