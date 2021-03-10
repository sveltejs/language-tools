import { Node } from 'estree-walker';
import { extract_identifiers } from 'periscopic';
import { SvelteIdentifier } from '../../interfaces';
import { isDestructuringPatterns, isIdentifier } from '../../utils/svelteAst';
import { usesLet } from '../utils/node-utils';

export class TemplateScope {
    inits = new Set<string>();
    parent?: TemplateScope;

    constructor(parent?: TemplateScope) {
        this.parent = parent;
    }

    child() {
        const child = new TemplateScope(this);
        return child;
    }
}

export class TemplateScopeManager {
    value = new TemplateScope();

    eachEnter(node: Node) {
        this.value = this.value.child();
        if (node.context) {
            this.handleScope(node.context);
        }
        if (node.index) {
            this.value.inits.add(node.index);
        }
    }

    eachLeave(node: Node) {
        if (!node.else) {
            this.value = this.value.parent;
        }
    }

    awaitEnter(node: Node) {
        this.value = this.value.child();
        if (node.value) {
            this.handleScope(node.value);
        }
        if (node.error) {
            this.handleScope(node.error);
        }
    }

    awaitPendingEnter(node: Node, parent: Node) {
        if (node.skip || parent.type !== 'AwaitBlock') {
            return;
        }
        // Reset inits, as pending can have no inits
        this.value.inits.clear();
    }

    awaitThenEnter(node: Node, parent: Node) {
        if (node.skip || parent.type !== 'AwaitBlock') {
            return;
        }
        // Reset inits, this time only taking the then
        // scope into account.
        this.value.inits.clear();
        if (parent.value) {
            this.handleScope(parent.value);
        }
    }

    awaitCatchEnter(node: Node, parent: Node) {
        if (node.skip || parent.type !== 'AwaitBlock') {
            return;
        }
        // Reset inits, this time only taking the error
        // scope into account.
        this.value.inits.clear();
        if (parent.error) {
            this.handleScope(parent.error);
        }
    }

    awaitLeave() {
        this.value = this.value.parent;
    }

    elseEnter(parent: Node) {
        if (parent.type === 'EachBlock') {
            this.value = this.value.parent;
        }
    }

    componentOrSlotTemplateOrElementEnter(node: Node) {
        if (usesLet(node)) {
            this.value = this.value.child();
        }
    }

    componentOrSlotTemplateOrElementLeave(node: Node) {
        if (usesLet(node)) {
            this.value = this.value.parent;
        }
    }

    private handleScope(identifierDef: Node) {
        if (isIdentifier(identifierDef)) {
            this.value.inits.add(identifierDef.name);
        }
        if (isDestructuringPatterns(identifierDef)) {
            // the node object is returned as-it with no mutation
            const identifiers = extract_identifiers(identifierDef) as SvelteIdentifier[];
            identifiers.forEach((id) => this.value.inits.add(id.name));
        }
    }
}
