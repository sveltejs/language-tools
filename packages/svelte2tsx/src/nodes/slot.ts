import { Node, walk } from 'estree-walker';
import MagicString from 'magic-string';
import { attributeValueIsString, isMember } from '../utils/svelteAst';
import TemplateScope from './TemplateScope';

function AttributeStrValueAsJsExpression(htmlx: string, attr: Node): string {
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

    constructor(private readonly str: MagicString, private readonly htmlx: string) { }

    slots = new Map<string, Map<string, string>>();
    resloved = new Map<Node, string>();

    reslove(identifierDef: Node, initExpression: Node, scope: TemplateScope) {
        let resloved = this.resloved.get(identifierDef);
        if (resloved) {
            return resloved;
        }
        const { name } = identifierDef;

        const owner = scope.getOwner(name);

        if (owner.type === 'CatchBlock') {
            resloved = '__sveltets_any({})';
        } else if (owner.type === 'ThenBlock') {
            const reslovedExpression = this.resolveExpression(initExpression, scope);

            resloved = `__sveltets_unwrapPromiseLike(${reslovedExpression})`;
        } else if (owner.type === 'EachBlock') {
            const reslovedExpression = this.resolveExpression(initExpression, scope);

            resloved = `_sveltets_unwrapArr(${reslovedExpression})`;
        }
        this.resloved.set(identifierDef, resloved);
        return resloved;
    }

    private resolveExpression(expression: Node, scope: TemplateScope) {
        const strForExpression = new MagicString(this.htmlx);

        const identifiers: Node[] = [];
        walk(expression, {
            enter(node, parent, prop) {
                if (node.type === 'Identifier' && (!parent || !isMember(parent, prop))) {
                    this.skip();
                    identifiers.push(node);
                }
            }
        });

        for (const identifier of identifiers) {
            const { start, end, name } = identifier;
            const init = scope.getInit(name);
            const value = init ? this.resloved.get(init) : name;
            strForExpression.overwrite(start, end, value);
        }

        return strForExpression.slice(expression.start, expression.end);
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
                attributes.set(attr.name, AttributeStrValueAsJsExpression(this.str.original, attr));
                continue;
            }
            attributes.set(attr.name, this.resloveAttr(attr, scope));
        }
        this.slots.set(slotName, attributes);
    }

    getSlotDef() {
        return this.slots;
    }

    resloveAttr(attr: Node, scope: TemplateScope): string {
        const attrVal = attr.value[0];
        if (!attrVal) {
            return null;
        }

        if (attrVal.type == 'AttributeShorthand') {
            const { name } = attrVal.expression;
            const init = scope.getInit(name);
            const resolved = this.resloved.get(init);

            return resolved ?? name;
        }

        if (attrVal.type == 'MustacheTag') {
            return this.resolveExpression(attrVal.expression, scope);
        }
        throw Error('Unknown attribute value type:' + attrVal.type);
    }
}
