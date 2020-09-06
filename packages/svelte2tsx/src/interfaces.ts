import { Node } from 'estree-walker';
import { ArrayPattern, ObjectPattern, Identifier } from 'estree';

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

export type DirectiveType =
    | 'Action'
    | 'Animation'
    | 'Binding'
    | 'Class'
    | 'EventHandler'
    | 'Let'
    | 'Ref'
    | 'Transition';

export interface BaseDirective extends Node {
    type: DirectiveType;
    expression: null | Node;
    name: string;
    modifiers: string[];
}
