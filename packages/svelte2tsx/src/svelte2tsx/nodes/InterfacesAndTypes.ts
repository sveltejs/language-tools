import ts from 'typescript';
import { flatten } from '../../utils/object';

type TypeOrInterface = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

export class InterfacesAndTypes {
    node: TypeOrInterface | null = null;
    private all: TypeOrInterface[] = [];
    private references: Map<TypeOrInterface, ts.TypeReferenceNode[]> = new Map();

    add(node: TypeOrInterface) {
        this.all.push(node);
    }

    getNodesWithNames(names: string[]) {
        return this.all.filter((node) => names.includes(node.name.text));
    }

    // The following could be used to create a informative error message in case
    // someone has an interface that both references a generic and is used by one:

    addReference(reference: ts.TypeReferenceNode) {
        if (!this.node) {
            return;
        }

        const references = this.references.get(this.node) || [];
        references.push(reference);
        this.references.set(this.node, references);
    }

    getNodesThatReferenceType(name: string) {
        const nodes: TypeOrInterface[] = [];
        for (const [node, references] of this.references) {
            if (references.some((r) => r.typeName.getText() === name)) {
                nodes.push(node);
            }
        }
        return nodes;
    }

    getNodesThatRecursivelyReferenceType(name: string) {
        let types: string[] = [name];
        const nodes: Set<TypeOrInterface> = new Set();
        while (types.length !== 0) {
            const newTypes = flatten(
                types.map((type) => this.getNodesThatReferenceType(type))
            ).filter((t) => !nodes.has(t));
            newTypes.forEach((t) => nodes.add(t));
            types = newTypes.map((t) => t.name.text);
        }
        return [...nodes.values()];
    }

    getNodesThatRecursivelyReferenceTypes(names: string[]) {
        return flatten(names.map((name) => this.getNodesThatRecursivelyReferenceType(name)));
    }
}
