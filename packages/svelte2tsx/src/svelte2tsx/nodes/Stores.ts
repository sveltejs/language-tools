import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ScopeStack, Scope } from '../utils/Scope';
import { isObjectKey, isMember } from '../../utils/svelteAst';

export function handleStore(node: Node, parent: Node, str: MagicString): void {
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
            `${storename}.set( __sveltets_store_get(${storename}) ${operator}`,
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
                `${storename}.set( __sveltets_store_get(${storename}) ${simpleOperator} 1)`,
            );
        } else {
            console.warn(
                `Warning - unrecognized UpdateExpression operator ${parent.operator}!
                This is an edge case unaccounted for in svelte2tsx, please file an issue:
                https://github.com/sveltejs/language-tools/issues/new/choose
                `,
                str.original.slice(parent.start, parent.end),
            );
        }
        return;
    }

    //rewrite get
    const dollar = str.original.indexOf('$', node.start);
    str.overwrite(dollar, dollar + 1, '__sveltets_store_get(');
    str.prependLeft(node.end, ')');
}

type PendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
};

const reservedNames = new Set(['$$props', '$$restProps', '$$slots']);

export class Stores {
    pendingStoreResolutions: PendingStoreResolution<Node>[] = [];

    constructor(
        private scope: ScopeStack,
        private str: MagicString,
        private isDeclaration: { value: boolean },
    ) {}

    handleIdentifier(node: Node, parent: Node, prop: string): void {
        if (node.name[0] !== '$' || reservedNames.has(node.name)) {
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

    resolveStores(): void {
        this.pendingStoreResolutions.forEach((pending) => {
            let { node, parent, scope } = pending;
            const name = node.name;
            while (scope) {
                if (scope.declared.has(name)) {
                    //we were manually declared, this isn't a store access.
                    return;
                }
                scope = scope.parent;
            }
            //We haven't been resolved, we must be a store read/write, handle it.
            handleStore(node, parent, this.str);
        });
    }
}
