import MagicString from 'magic-string';
import ts from 'typescript';
import { Node } from 'estree-walker';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { throwError } from '../utils/error';

export class Generics {
    private definitions: string[] = [];
    private typeReferences: string[] = [];
    private references: string[] = [];
    genericsAttr: Node | undefined;

    constructor(private str: MagicString, private astOffset: number, script: Node) {
        this.genericsAttr = script.attributes.find((attr) => attr.name === 'generics');
        const generics = this.genericsAttr?.value[0]?.raw as string | undefined;
        if (generics) {
            this.definitions = generics.split(',').map((g) => g.trim());
            this.references = this.definitions.map((def) => def.split(/\s/)[0]);
        } else {
            this.genericsAttr = undefined;
        }
    }

    addIfIsGeneric(node: ts.Node) {
        if (ts.isTypeAliasDeclaration(node) && this.is$$GenericType(node.type)) {
            if (this.genericsAttr) {
                throw new Error(
                    'Invalid $$Generic declaration: $$Generic definitions are not allowed when the generics attribute is present on the script tag'
                );
            }
            if (node.type.typeArguments?.length > 1) {
                throw new Error('Invalid $$Generic declaration: Only one type argument allowed');
            }
            if (node.type.typeArguments?.length === 1) {
                const typeReference = node.type.typeArguments[0].getText();
                this.typeReferences.push(typeReference);
                this.definitions.push(`${node.name.text} extends ${typeReference}`);
            } else {
                this.definitions.push(node.name.text);
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

    getTypeReferences() {
        return this.typeReferences;
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
