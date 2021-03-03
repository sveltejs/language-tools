export class Scope {
    declared: Set<string> = new Set();
    parent: Scope;

    constructor(parent?: Scope) {
        this.parent = parent;
    }

    hasDefined(name: string) {
        return this.declared.has(name) || (!!this.parent && this.parent.hasDefined(name));
    }
}

export class ScopeStack {
    current = new Scope();

    push() {
        this.current = new Scope(this.current);
    }

    pop() {
        this.current = this.current.parent;
    }
}
