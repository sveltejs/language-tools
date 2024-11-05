import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { isMember, isObjectKey } from '../../utils/svelteAst';
import { Scope, ScopeStack } from '../utils/Scope';

type PossibleStore = {
    node: Node;
    parent: Node;
    scope: Scope;
};

const reservedNames = new Set(['$$props', '$$restProps', '$$slots']);

export class Stores {
    possibleStores: PossibleStore[] = [];

    constructor(
        private scope: ScopeStack,
        private isDeclaration: { value: boolean }
    ) {}

    handleDirective(node: Node, str: MagicString): void {
        if (this.notAStore(node.name) || this.isDeclaration.value) {
            return;
        }

        const start = str.original.indexOf('$', node.start);
        const end = start + node.name.length;
        this.possibleStores.push({
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
            this.possibleStores.push({ node, parent, scope: this.scope.current });
        }
    }

    getStoreNames(): string[] {
        const stores = this.possibleStores.filter(({ node, scope }) => {
            const name = node.name;
            // if variable starting with '$' was manually declared by the user,
            // this isn't a store access.
            return !scope.hasDefined(name);
        });

        return stores.map(({ node }) => node.name.slice(1));
    }

    private notAStore(name: string): boolean {
        return name[0] !== '$' || reservedNames.has(name);
    }
}
