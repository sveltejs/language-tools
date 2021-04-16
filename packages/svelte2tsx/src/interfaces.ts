import { ArrayPattern, ObjectPattern, Identifier } from 'estree';
import {
	Directive,
	TemplateNode,
	Transition,
	MustacheTag,
	Text
} from 'svelte/types/compiler/interfaces';

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

export type BaseNode = Exclude<TemplateNode, Text | MustacheTag | Directive | Transition>;

export type BaseDirective = Exclude<Directive, Transition>;

export interface Attribute extends BaseNode {
	value: BaseNode[] | true;
}
