export default class TemplateScope {
    inits = new Set<string>();
    parent?: TemplateScope;

    constructor(parent?: TemplateScope) {
        this.parent = parent;
    }

    addMany(inits: string[]) {
        inits.forEach((item) => this.add(item));
        return this;
    }

    add(name: string) {
        this.inits.add(name);
        return this;
    }

    child() {
        const child = new TemplateScope(this);
        return child;
    }
}
