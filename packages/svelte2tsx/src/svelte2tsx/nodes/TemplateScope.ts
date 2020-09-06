import { Node } from 'estree-walker';
import { WithName } from '../../interfaces';

/**
 * adopted from https://github.com/sveltejs/svelte/blob/master/src/compiler/compile/nodes/shared/TemplateScope.ts
 */
export default class TemplateScope {
    names: Set<string>;
    owners: Map<string, Node> = new Map();
    inits: Map<string, WithName> = new Map();
    parent?: TemplateScope;

    constructor(parent?: TemplateScope) {
        this.parent = parent;
        this.names = new Set(parent ? parent.names : []);
    }

    addMany(inits: WithName[], owner: Node) {
        inits.forEach((item) => this.add(item, owner));
        return this;
    }

    add(init: WithName, owner: Node) {
        const { name } = init;
        this.names.add(name);
        this.inits.set(name, init);
        this.owners.set(name, owner);
        return this;
    }

    child() {
        const child = new TemplateScope(this);
        return child;
    }

    getOwner(name: string): Node {
        return this.owners.get(name) || this.parent?.getOwner(name);
    }

    getInit(name: string): WithName {
        return this.inits.get(name) || this.parent?.getInit(name);
    }

    isLet(name: string) {
        const owner = this.getOwner(name);
        return owner && (owner.type === 'Element' || owner.type === 'InlineComponent');
    }
}
