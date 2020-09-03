import { Node, walk } from 'estree-walker';
import MagicString from 'magic-string';
import {
    attributeValueIsString,
    isMember,
    isObjectKey,
    isObjectValueShortHand,
    isObjectValue,
    getSlotName,
} from '../utils/svelteAst';
import TemplateScope from './TemplateScope';
import { SvelteIdentifier, WithName, BaseDirective } from '../interfaces';
import { getTypeForComponent } from '../htmlxtojsx/utils/node-utils';

function attributeStrValueAsJsExpression(attr: Node): string {
    if (attr.value.length == 0) return "''"; //wut?

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

    private getResolveExpressionStr(
        identifierDef: SvelteIdentifier,
        scope: TemplateScope,
        initExpression: Node,
    ) {
        const { name } = identifierDef;

        const owner = scope.getOwner(name);

        if (owner?.type === 'CatchBlock') {
            return '__sveltets_any({})';
        }

        // list.map(list => list.someProperty)
        // initExpression's scope should the parent scope of identifier scope
        else if (owner?.type === 'ThenBlock') {
            const resolvedExpression = this.resolveExpression(initExpression, scope.parent);

            return `__sveltets_unwrapPromiseLike(${resolvedExpression})`;
        } else if (owner?.type === 'EachBlock') {
            const resolvedExpression = this.resolveExpression(initExpression, scope.parent);

            return `__sveltets_unwrapArr(${resolvedExpression})`;
        }
        return null;
    }

    resolveDestructuringAssignment(
        destructuringNode: Node,
        identifiers: SvelteIdentifier[],
        initExpression: Node,
        scope: TemplateScope,
    ) {
        const destructuring = this.htmlx.slice(destructuringNode.start, destructuringNode.end);
        identifiers.forEach((identifier) => {
            const resolved = this.getResolveExpressionStr(identifier, scope, initExpression);
            if (resolved) {
                this.resolved.set(
                    identifier,
                    `((${destructuring}) => ${identifier.name})(${resolved})`,
                );
            }
        });
    }

    resolveDestructuringAssignmentForLet(
        destructuringNode: Node,
        identifiers: SvelteIdentifier[],
        letNode: BaseDirective,
        component: Node,
        slotName: string,
    ) {
        const destructuring = this.htmlx.slice(destructuringNode.start, destructuringNode.end);
        identifiers.forEach((identifier) => {
            const resolved = this.getResolveExpressionStrForLet(letNode, component, slotName);
            this.resolved.set(
                identifier,
                `((${destructuring}) => ${identifier.name})(${resolved})`,
            );
        });
    }

    private getResolveExpressionStrForLet(
        letNode: BaseDirective,
        component: Node,
        slotName: string,
    ) {
        return `${getSingleSlotDef(component, slotName)}.${letNode.name}`;
    }

    resolveLet(letNode: BaseDirective, identifierDef: WithName, component: Node, slotName: string) {
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
            (attr) => attr.type === 'Let',
        ) as BaseDirective[];

        return letNodes?.map((letNode) => ({
            letNode,
            slotName,
        }));
    }

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
                        if (isMember(parent, prop)) return;
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
            },
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
            if (attr.name == 'name') continue;
            if (!attr.value.length) continue;

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

export function getSingleSlotDef(componentNode: Node, slotName: string) {
    const componentType = getTypeForComponent(componentNode);
    return `__sveltets_instanceOf(${componentType}).$$slot_def['${slotName}']`;
}
