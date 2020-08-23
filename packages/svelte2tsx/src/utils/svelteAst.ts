import { Node } from 'estree-walker';
import { Identifier, BaseNode, ArrayPattern, ObjectPattern, IdentifierWithRange } from '../interfaces';

export function isMember(parent: Node, prop: string) {
    return parent.type == 'MemberExpression' && prop == 'property';
}

export function isObjectKey(parent: Node, prop: string) {
    return parent.type == 'Property' && prop == 'key';
}

export function isObjectValue(parent: Node, prop: string) {
    return parent.type == 'Property' && prop == 'value';
}

export function isObjectValueShortHand(property: Node) {
    const { value, key } = property;
    return value && isIdentifierWithRange(value)
        && key.start === value.start && key.end == value.end;
}

export function isText(node: Node) {
    return node.type === 'Text';
}

export function attributeValueIsString(attr: Node) {
    return attr.value.length !== 1 || attr.value[0]?.type === 'Text';
}

export function isDestructuringPatterns(node: BaseNode): node is ArrayPattern | ObjectPattern {
    return node.type === 'ArrayPattern' || node.type === 'ObjectPattern';
}

export function isIdentifier(node: any): node is Identifier {
    return node.type === 'Identifier';
}

export function isIdentifierWithRange(node: any): node is IdentifierWithRange {
    return node.type === 'Identifier' && 'start' in node && 'end' in node;
}

export function getSlotName(child: Node): string | undefined {
    const slot = (child.attributes as Node[])?.find((a) => a.name == 'slot');

    return slot?.value?.[0].raw;
}
