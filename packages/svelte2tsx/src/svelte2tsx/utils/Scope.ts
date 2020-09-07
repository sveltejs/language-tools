export class Scope {
    declared: Set<string> = new Set();
    parent: Scope;

    constructor(parent?: Scope) {
        this.parent = parent;
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
