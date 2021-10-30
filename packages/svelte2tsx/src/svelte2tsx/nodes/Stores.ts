import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ScopeStack, Scope } from '../utils/Scope';
import { isObjectKey, isMember } from '../../utils/svelteAst';
import { assignmentBindings } from '../../htmlxtojsx/nodes/binding';

export function handleStore(node: Node, parent: Node, str: MagicString): void {
    const storename = node.name.slice(1);

    //handle assign to
    if (parent.type == 'AssignmentExpression' && parent.left == node && parent.operator == '=') {
        const dollar = str.original.indexOf('$', node.start);
        str.remove(dollar, dollar + 1);
        str.overwrite(node.end, str.original.indexOf('=', node.end) + 1, '.set(');
        str.appendLeft(parent.end, ')');
        return;
    }

    // handle Assignment operators ($store +=, -=, *=, /=, %=, **=, etc.)
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators#Assignment
    const operators = ['+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '^=', '|='];
    if (
        parent.type == 'AssignmentExpression' &&
        parent.left == node &&
        operators.includes(parent.operator)
    ) {
        const storename = node.name.slice(1); // drop the $
        const operator = parent.operator.substring(0, parent.operator.length - 1); // drop the = sign
        str.overwrite(
            parent.start,
            str.original.indexOf('=', node.end) + 1,
            `${storename}.set( $${storename} ${operator}`
        );
        str.appendLeft(parent.end, ')');
        return;
    }

    // handle $store++, $store--, ++$store, --$store
    if (parent.type == 'UpdateExpression') {
        let simpleOperator;
        if (parent.operator === '++') simpleOperator = '+';
        if (parent.operator === '--') simpleOperator = '-';
        if (simpleOperator) {
            const storename = node.name.slice(1); // drop the $
            str.overwrite(
                parent.start,
                parent.end,
                `${storename}.set( $${storename} ${simpleOperator} 1)`
            );
        } else {
            console.warn(
                `Warning - unrecognized UpdateExpression operator ${parent.operator}!
                This is an edge case unaccounted for in svelte2tsx, please file an issue:
                https://github.com/sveltejs/language-tools/issues/new/choose
                `,
                str.original.slice(parent.start, parent.end)
            );
        }
        return;
    }

    const dollar = str.original.indexOf('$', node.start);

    // handle bindings which are transformed to assignments. These need special treatment because
    // `(__sveltets_1_store_get(foo), foo$) = something` is syntactically invalid
    // Therefore remove the outer commas. Note: This relies on the binding expression wrapping
    // this statement with __sveltets_1_empty
    if (parent.type === 'Binding' && assignmentBindings.has(parent.name)) {
        str.overwrite(dollar, dollar + 1, '__sveltets_1_store_get(', { contentOnly: true });
        str.prependLeft(node.end, `), $${storename}`);
        return;
    }

    // we change "$store" references into "(__sveltets_1_store_get(store), $store)"
    // - in order to get ts errors if store is not assignable to SvelteStore
    // - use $store variable defined above to get ts flow control
    str.overwrite(dollar, dollar + 1, '(__sveltets_1_store_get(', { contentOnly: true });
    str.prependLeft(node.end, `), $${storename})`);
}

type PendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
};

const reservedNames = new Set(['$$props', '$$restProps', '$$slots']);

export class Stores {
    pendingStoreResolutions: Array<PendingStoreResolution<Node>> = [];

    constructor(
        private scope: ScopeStack,
        private str: MagicString,
        private isDeclaration: { value: boolean }
    ) {}

    handleDirective(node: Node, str: MagicString): void {
        if (this.notAStore(node.name) || this.isDeclaration.value) {
            return;
        }

        const start = str.original.indexOf('$', node.start);
        const end = start + node.name.length;
        this.pendingStoreResolutions.push({
            node: { type: 'Identifier', start, end, name: node.name },
            parent: { start: 0, end: 0, type: '' },
            scope: this.scope.current
        });
    }

    handleIdentifier(node: Node, parent: Node, prop: string): void {
        if (this.notAStore(node.name)) {
            return;
        }

        //handle potential store
        if (this.isDeclaration.value) {
            if (isObjectKey(parent, prop)) {
                return;
            }
            this.scope.current.declared.add(node.name);
        } else {
            if (isMember(parent, prop) && !parent.computed) {
                return;
            }
            if (isObjectKey(parent, prop)) {
                return;
            }
            this.pendingStoreResolutions.push({ node, parent, scope: this.scope.current });
        }
    }

    resolveStores(): string[] {
        const unresolvedStores = this.pendingStoreResolutions.filter(({ node, scope }) => {
            const name = node.name;
            // if variable starting with '$' was manually declared by the user,
            // this isn't a store access.
            return !scope.hasDefined(name);
        });

        unresolvedStores.forEach(({ node, parent }) => handleStore(node, parent, this.str));

        return unresolvedStores.map(({ node }) => node.name.slice(1));
    }

    private notAStore(name: string): boolean {
        return name[0] !== '$' || reservedNames.has(name);
    }
}
