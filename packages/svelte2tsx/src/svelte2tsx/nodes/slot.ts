import { Node, walk } from 'estree-walker';
import MagicString from 'magic-string';
import {
    attributeValueIsString,
    isMember,
    isObjectKey,
    isObjectValueShortHand,
    isObjectValue,
    getSlotName
} from '../../utils/svelteAst';
import TemplateScope from './TemplateScope';
import { SvelteIdentifier, WithName } from '../../interfaces';
// @ts-ignore
import { Directive } from 'svelte/types/compiler/interfaces';
import ts from 'typescript';
import { isInterfaceOrTypeDeclaration } from '../utils/tsAst';

/**
 * Get the constructor type of a component node
 * @param node The component node to infer the this type from
 * @param thisValue If node is svelte:component, you may pass the value
 *                  of this={..} to use that instead of the more general componentType
 */
export function getTypeForComponent(node: Node): string {
    if (node.name === 'svelte:component' || node.name === 'svelte:self') {
        return '__sveltets_1_componentType()';
    } else {
        return node.name;
    }
}

function attributeStrValueAsJsExpression(attr: Node): string {
    if (attr.value.length == 0) {
        return "''"; //wut?
    }

    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        if (attrVal.type == 'Text') {
            return '"' + attrVal.raw + '"';
        }
    }

    // we have multiple attribute values, so we know we are building a string out of them.
    // so return a dummy string, it will typecheck the same :)
    return '"__svelte_ts_string"';
}

export function is$$SlotsDeclaration(
    node: ts.Node
): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
    return isInterfaceOrTypeDeclaration(node) && node.name.text === '$$Slots';
}

export class SlotHandler {
    constructor(private readonly htmlx: string) {}

    slots = new Map<string, Map<string, string>>();
    resolved = new Map<WithName, string>();
    resolvedExpression = new Map<Node, string>();

    resolve(identifierDef: SvelteIdentifier, initExpression: Node, scope: TemplateScope) {
        let resolved = this.resolved.get(identifierDef);
        if (resolved) {
            return resolved;
        }

        resolved = this.getResolveExpressionStr(identifierDef, scope, initExpression);
        if (resolved) {
            this.resolved.set(identifierDef, resolved);
        }

        return resolved;
    }

    /**
     * Returns a string which expresses the given identifier unpacked to
     * the top level in order to express the slot types correctly later on.
     *
     * Example: {#each items as item} ---> __sveltets_2_unwrapArr(items)
     */
    private getResolveExpressionStr(
        identifierDef: SvelteIdentifier,
        scope: TemplateScope,
        initExpression: Node
    ) {
        const { name } = identifierDef;

        const owner = scope.getOwner(name);

        if (owner?.type === 'CatchBlock') {
            return '__sveltets_2_any({})';
        }

        // list.map(list => list.someProperty)
        // initExpression's scope should the parent scope of identifier scope
        else if (owner?.type === 'ThenBlock') {
            const resolvedExpression = this.resolveExpression(initExpression, scope.parent);

            return `__sveltets_2_unwrapPromiseLike(${resolvedExpression})`;
        } else if (owner?.type === 'EachBlock') {
            const resolvedExpression = this.resolveExpression(initExpression, scope.parent);

            return `__sveltets_2_unwrapArr(${resolvedExpression})`;
        }
        return null;
    }

    resolveDestructuringAssignment(
        destructuringNode: Node,
        identifiers: SvelteIdentifier[],
        initExpression: Node,
        scope: TemplateScope
    ) {
        const destructuring = this.htmlx.slice(destructuringNode.start, destructuringNode.end);
        identifiers.forEach((identifier) => {
            const resolved = this.getResolveExpressionStr(identifier, scope, initExpression);
            if (resolved) {
                this.resolved.set(
                    identifier,
                    `((${destructuring}) => ${identifier.name})(${resolved})`
                );
            }
        });
    }

    resolveDestructuringAssignmentForLet(
        destructuringNode: Node,
        identifiers: SvelteIdentifier[],
        letNode: Directive,
        component: Node,
        slotName: string
    ) {
        const destructuring = this.htmlx.slice(destructuringNode.start, destructuringNode.end);
        identifiers.forEach((identifier) => {
            const resolved = this.getResolveExpressionStrForLet(letNode, component, slotName);
            this.resolved.set(
                identifier,
                `((${destructuring}) => ${identifier.name})(${resolved})`
            );
        });
    }

    private getResolveExpressionStrForLet(letNode: Directive, component: Node, slotName: string) {
        return `${getSingleSlotDef(component, slotName)}.${letNode.name}`;
    }

    resolveLet(letNode: Directive, identifierDef: WithName, component: Node, slotName: string) {
        let resolved = this.resolved.get(identifierDef);
        if (resolved) {
            return resolved;
        }

        resolved = this.getResolveExpressionStrForLet(letNode, component, slotName);

        this.resolved.set(identifierDef, resolved);

        return resolved;
    }

    getSlotConsumerOfComponent(component: Node) {
        let result = this.getLetNodes(component, 'default') ?? [];
        for (const child of component.children) {
            const slotName = getSlotName(child);

            if (slotName) {
                const letNodes = this.getLetNodes(child, slotName);

                if (letNodes?.length) {
                    result = result.concat(letNodes);
                }
            }
        }

        return result;
    }

    private getLetNodes(child: Node, slotName: string) {
        const letNodes = ((child?.attributes as Node[]) ?? []).filter(
            (attr) => attr.type === 'Let'
        ) as Directive[];

        return letNodes?.map((letNode) => ({
            letNode,
            slotName
        }));
    }

    /**
     * Resolves the slot expression to a string that can be used
     * in the props-object in the return type of the render function
     */
    private resolveExpression(expression: Node, scope: TemplateScope) {
        let resolved = this.resolvedExpression.get(expression);
        if (resolved) {
            return resolved;
        }

        const strForExpression = new MagicString(this.htmlx);

        const identifiers: Node[] = [];
        const objectShortHands: Node[] = [];
        walk(expression, {
            enter(node, parent, prop) {
                if (node.type === 'Identifier') {
                    if (parent) {
                        if (isMember(parent, prop)) {
                            return;
                        }
                        if (isObjectKey(parent, prop)) {
                            return;
                        }
                        if (isObjectValue(parent, prop)) {
                            // { value }
                            if (isObjectValueShortHand(parent)) {
                                this.skip();
                                objectShortHands.push(node);
                                return;
                            }
                        }
                    }

                    this.skip();
                    identifiers.push(node);
                }
            }
        });

        const getOverwrite = (name: string) => {
            const init = scope.getInit(name);
            return init ? this.resolved.get(init) : name;
        };
        for (const identifier of objectShortHands) {
            const { end, name } = identifier;
            const value = getOverwrite(name);
            strForExpression.appendLeft(end, `:${value}`);
        }
        for (const identifier of identifiers) {
            const { start, end, name } = identifier;
            const value = getOverwrite(name);
            strForExpression.overwrite(start, end, value);
        }

        resolved = strForExpression.slice(expression.start, expression.end);
        this.resolvedExpression.set(expression, resolved);

        return resolved;
    }

    handleSlot(node: Node, scope: TemplateScope) {
        const nameAttr = node.attributes.find((a: Node) => a.name == 'name');
        const slotName = nameAttr ? nameAttr.value[0].raw : 'default';
        //collect attributes
        const attributes = new Map<string, string>();
        for (const attr of node.attributes) {
            if (attr.name == 'name') {
                continue;
            }

            if (attr.type === 'Spread') {
                const rawName = attr.expression.name;
                const init = scope.getInit(rawName);
                const name = init ? this.resolved.get(init) : rawName;
                attributes.set(`__spread__${name}`, name);
            }

            if (!attr.value?.length) {
                continue;
            }

            if (attributeValueIsString(attr)) {
                attributes.set(attr.name, attributeStrValueAsJsExpression(attr));
                continue;
            }
            attributes.set(attr.name, this.resolveAttr(attr, scope));
        }
        this.slots.set(slotName, attributes);
    }

    getSlotDef() {
        return this.slots;
    }

    resolveAttr(attr: Node, scope: TemplateScope): string {
        const attrVal = attr.value[0];
        if (!attrVal) {
            return null;
        }

        if (attrVal.type == 'AttributeShorthand') {
            const { name } = attrVal.expression;
            const init = scope.getInit(name);
            const resolved = this.resolved.get(init);

            return resolved ?? name;
        }

        if (attrVal.type == 'MustacheTag') {
            return this.resolveExpression(attrVal.expression, scope);
        }

        throw Error('Unknown attribute value type:' + attrVal.type);
    }
}

function getSingleSlotDef(componentNode: Node, slotName: string) {
    // In contrast to getSingleSlotDef in htmlx2jsx, use a simple instanceOf-transformation here.
    // This means that if someone forwards a slot whose type can only be infered from the input properties
    // because there's a generic relationship, then that slot type is of type any or unknown.
    // This is a limitation which could be tackled later. The problem is that in contrast to the transformation
    // in htmlx2jsx, we cannot know for sure that all properties we would generate the component with exist
    // in this scope, some could have been generated through each/await blocks or other lets.
    const componentType = getTypeForComponent(componentNode);
    return `__sveltets_2_instanceOf(${componentType}).$$slot_def['${slotName}']`;
}
