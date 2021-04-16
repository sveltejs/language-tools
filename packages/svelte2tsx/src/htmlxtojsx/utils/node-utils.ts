import { Node, walk } from 'estree-walker';
import { BaseNode } from '../../interfaces';

export function getTypeForComponent(node: Node): string {
	if (node.name === 'svelte:component' || node.name === 'svelte:self') {
		return '__sveltets_componentType()';
	} else {
		return node.name;
	}
}

export function getThisType(node: Node): string | undefined {
	switch (node.type) {
		case 'InlineComponent':
			return getTypeForComponent(node);
		case 'Element':
			return `__sveltets_ctorOf(__sveltets_mapElementTag('${node.name}'))`;
		case 'Body':
			return 'HTMLBodyElement';
		case 'Slot': // Web Components only
			return 'HTMLSlotElement';
	}
}

export function beforeStart(start: number): number {
	return start - 1;
}

export function isShortHandAttribute(attr: Node): boolean {
	return attr.expression.end === attr.end;
}

export function isQuote(str: string): boolean {
	return str === '"' || str === "'";
}

export function getIdentifiersInIfExpression(
	expression: Node
): Map<string, Array<{ start: number; end: number }>> {
	const offset = expression.start;
	const identifiers = new Map<string, Array<{ start: number; end: number }>>();
	walk(expression, {
		enter: (node, parent) => {
			switch (node.type) {
				case 'Identifier':
					// parent.property === node => node is "prop" in "obj.prop"
					// parent.callee === node => node is "fun" in "fun(..)"
					if (parent?.property !== node && parent?.callee !== node) {
						add(node);
					}
					break;
			}
		}
	});

	function add(node: Node) {
		let entry = identifiers.get(node.name);
		if (!entry) {
			entry = [];
		}
		entry.push({ start: node.start - offset, end: node.end - offset });
		identifiers.set(node.name, entry);
	}

	return identifiers;
}

export function usesLet(node: BaseNode): boolean {
	return node.attributes?.some((attr) => attr.type === 'Let');
}
