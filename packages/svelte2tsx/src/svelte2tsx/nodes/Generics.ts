import MagicString from 'magic-string';
import ts from 'typescript';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { throwError } from '../utils/error';

export class Generics {
    private definitions: string[] = [];
    private references: string[] = [];

    constructor(private str: MagicString, private astOffset: number) {}

    addIfIsGeneric(node: ts.Node) {
        if (ts.isTypeAliasDeclaration(node) && this.is$$GenericType(node.type)) {
            if (node.type.typeArguments?.length > 1) {
                throw new Error('Invalid $$Generic declaration: Only one type argument allowed');
            }
            if (node.type.typeArguments?.length === 1) {
                this.definitions.push(
                    `${node.name.text} extends ${node.type.typeArguments[0].getText()}`
                );
            } else {
                this.definitions.push(`${node.name.text}`);
            }
            this.references.push(node.name.text);
            this.str.remove(this.astOffset + node.getStart(), this.astOffset + node.getEnd());
        }
    }

    throwIfIsGeneric(node: ts.Node) {
        if (ts.isTypeAliasDeclaration(node) && this.is$$GenericType(node.type)) {
            throwError(
                this.astOffset + node.getStart(),
                this.astOffset + node.getEnd(),
                '$$Generic declarations are only allowed in the instance script',
                this.str.original
            );
        }
    }

    private is$$GenericType(node: ts.TypeNode): node is ts.TypeReferenceNode {
        return (
            ts.isTypeReferenceNode(node) &&
            ts.isIdentifier(node.typeName) &&
            node.typeName.text === '$$Generic'
        );
    }

    toDefinitionString(addIgnore = false) {
        const surround = addIgnore ? surroundWithIgnoreComments : (str: string) => str;
        return this.definitions.length ? surround(`<${this.definitions.join(',')}>`) : '';
    }

    toReferencesString() {
        return this.references.length ? `<${this.references.join(',')}>` : '';
    }

    has() {
        return this.definitions.length > 0;
    }
}
