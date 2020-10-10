import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ScopeStack, Scope } from '../utils/Scope';
import { isObjectKey, isMember } from '../../utils/svelteAst';
import { uniq } from '../../utils/uniq';

export function handleStore(
    node: Node,
    parent: Node,
    str: MagicString,
    canBeHoisted: boolean,
): void {
    const storeName = node.name.slice(1); // drop the $
    const storeGetterPrefix = canBeHoisted
        ? `__svelte_store_get_values__['`
        : '__sveltets_store_get(';
    const storeGetterPostfix = canBeHoisted ? `']` : ')';
    const storeGetter = `${storeGetterPrefix}${storeName}${storeGetterPostfix}`;

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
        const operator = parent.operator.substring(0, parent.operator.length - 1); // drop the = sign
        str.overwrite(
            parent.start,
            str.original.indexOf('=', node.end) + 1,
            `${storeName}.set( ${storeGetter} ${operator}`,
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
            str.overwrite(
                parent.start,
                parent.end,
                `${storeName}.set( ${storeGetter} ${simpleOperator} 1)`,
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
    // remove dollar and wrap with accessor to store value
    const dollar = str.original.indexOf('$', node.start);
    str.overwrite(dollar, dollar + 1, storeGetterPrefix);
    str.prependLeft(node.end, storeGetterPostfix);
}

type PendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
    canBeHoisted: boolean;
};

const reservedNames = new Set(['$$props', '$$restProps', '$$slots']);

export class Stores {
    pendingStoreResolutions: PendingStoreResolution<Node>[] = [];

    constructor(
        private scope: ScopeStack,
        private str: MagicString,
        private isDeclaration: { value: boolean },
    ) {}

    handleIdentifier(node: Node, parent: Node, prop: string, canBeHoisted: boolean): void {
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
            this.pendingStoreResolutions.push({
                node,
                parent,
                scope: this.scope.current,
                canBeHoisted,
            });
        }
    }

    resolveStores(): string[] {
        const topLevelStores = this.pendingStoreResolutions
            .filter(({ canBeHoisted }) => canBeHoisted)
            .map(({ node: { name } }) => name.replace(/^\$/, ''));

        this.pendingStoreResolutions.forEach((pending) => {
            let { node, parent, scope, canBeHoisted } = pending;
            const name = node.name;
            while (scope) {
                if (scope.declared.has(name)) {
                    //we were manually declared, this isn't a store access.
                    return;
                }
                scope = scope.parent;
            }
            //We haven't been resolved, we must be a store read/write, handle it.
            handleStore(node, parent, this.str, canBeHoisted);
        });

        return uniq(topLevelStores);
    }
}
