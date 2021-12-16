import { Node, walk } from 'estree-walker';
import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';

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

/**
 * Get the instance type of a node from its constructor.
 */
export function getInstanceTypeSimple(node: Node, str: MagicString): string | undefined {
    const instanceOf = (str: string) => `__sveltets_1_instanceOf(${str})`;

    switch (node.type) {
        case 'InlineComponent':
            if (node.name === 'svelte:component' && node.expression) {
                const thisVal = str.original.substring(node.expression.start, node.expression.end);
                return `new (${thisVal})({target: __sveltets_1_any(''), props: __sveltets_1_any('')})`;
            } else if (node.name === 'svelte:component' || node.name === 'svelte:self') {
                return instanceOf('__sveltets_1_componentType()');
            } else {
                return `new ${node.name}({target: __sveltets_1_any(''), props: __sveltets_1_any('')})`;
            }
        case 'Element':
            return instanceOf(`__sveltets_1_ctorOf(__sveltets_1_mapElementTag('${node.name}'))`);
        case 'Body':
            return instanceOf('HTMLBodyElement');
        case 'Slot': // Web Components only
            return instanceOf('HTMLSlotElement');
    }
}

/**
 * Get the instance type of a node from its constructor.
 * If it's a component, pass in the exact props. This ensures that
 * the component instance has the right type in case of generic prop types.
 */
export function getInstanceType(
    node: Node,
    originalStr: string,
    replacedPropValues: PropsShadowedByLet[] = []
): string {
    if (node.name === 'svelte:component' || node.name === 'svelte:self') {
        return '__sveltets_1_instanceOf(__sveltets_1_componentType())';
    }

    const propsStr = getNameValuePairsFromAttributes(node, originalStr)
        .map(({ name, value }) => {
            const replacedPropValue = replacedPropValues.find(
                ({ name: propName }) => propName === name
            )?.replacement;
            return `'${name}':${replacedPropValue || value}`;
        })
        .join(', ');
    return surroundWithIgnoreComments(
        `new ${node.name}({target: __sveltets_1_any(''), props: {${propsStr}}})`
    );
}

export interface PropsShadowedByLet {
    name: string;
    value: string;
    replacement: string;
}

/**
 * Return a string which makes it possible for TypeScript to infer the instance type of the given component.
 * In the case of another component, this is done by creating a `new Comp({.. props: {..}})` code string.
 * Alongside with the result a list of shadowed props is returned. A shadowed prop is a prop
 * whose value is either too complex to analyse or contains an identifier which has the same name
 * as a `let:X` expression on the component. In that case, the returned string only contains a reference
 * to a constant which is `replacedPropsPrefix + propName`, so the calling code needs to make sure
 * to create such a `const`.
 */
export function getInstanceTypeForDefaultSlot(
    node: Node,
    originalStr: string,
    replacedPropsPrefix: string
): { str: string; shadowedProps: PropsShadowedByLet[] } {
    if (node.name === 'svelte:component' || node.name === 'svelte:self') {
        return {
            str: '__sveltets_1_instanceOf(__sveltets_1_componentType())',
            shadowedProps: []
        };
    }

    const lets = new Set<string>(
        (node.attributes || []).filter((attr) => attr.type === 'Let').map((attr) => attr.name)
    );
    const shadowedProps: PropsShadowedByLet[] = [];
    // Go through attribute values and mark those for reassignment to a const that
    // either definitely shadow a let: or where it cannot be determined because the value is too complex.
    const propsStr = getNameValuePairsFromAttributes(node, originalStr)
        .map(({ name, value, identifier, complexExpression }) => {
            if (complexExpression || lets.has(identifier)) {
                const replacement = replacedPropsPrefix + sanitizePropName(name);
                shadowedProps.push({ name, value, replacement });
                return `'${name}':${replacement}`;
            } else {
                return `'${name}':${value}`;
            }
        })
        .join(', ');
    const str = surroundWithIgnoreComments(
        `new ${node.name}({target: __sveltets_1_any(''), props: {${propsStr}}})`
    );
    return { str, shadowedProps };
}

function getNameValuePairsFromAttributes(
    node: Node,
    originalStr: string
): Array<{
    /**
     * Attribute name
     */
    name: string;
    /**
     * Attribute value string
     */
    value: string;
    /**
     * If the attribute value's identifier can be determined, it's a string with its name.
     * If the attribute value has no identifier or is too complex, it's unset.
     */
    identifier?: string;
    /**
     * If the attribute's value is too complex to determine a specific identifier from it,
     * this is true.
     */
    complexExpression?: true;
}> {
    return ((node.attributes as Node[]) || [])
        .filter((attr) => attr.type === 'Attribute' && !attr.name.startsWith('--'))
        .map((attr) => {
            const name: string = attr.name;

            if (attr.value === true) {
                return { name, value: 'true' };
            }

            if (attr.value.length === 1) {
                const val = attr.value[0];
                if (val.type === 'AttributeShorthand') {
                    return { name, value: name, identifier: name };
                }
                if (val.type === 'Text') {
                    const quote = ['"', "'"].includes(originalStr[val.start - 1])
                        ? originalStr[val.start - 1]
                        : "'";
                    return { name, value: `${quote}${val.data || val.raw}${quote}` };
                }
                if (val.type === 'MustacheTag') {
                    const valueStr = originalStr.substring(val.start + 1, val.end - 1);
                    if (val.expression.type === 'Identifier') {
                        return { name, value: valueStr, identifier: valueStr };
                    }
                    if (val.expression.type === 'Literal') {
                        const value =
                            typeof val.expression.value === 'string'
                                ? val.expression.raw
                                : val.expression.value;
                        return { name, value };
                    }
                    return { name, value: valueStr, complexExpression: true };
                }
            }

            if (!attr.value.length) {
                return { name, value: '""' };
            }

            const value = attr.value
                .map((val) =>
                    val.type === 'Text'
                        ? val.raw
                        : val.type === 'MustacheTag'
                        ? '$' + originalStr.substring(val.start, val.end)
                        : ''
                )
                .join('');

            return { name, value: `\`${value}\`` };
        });
}

function sanitizePropName(name: string): string {
    return name
        .split('')
        .map((char) => (/[0-9A-Za-z$_]/.test(char) ? char : '_'))
        .join('');
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
