import MagicString from 'magic-string';
import ts from 'typescript';

/**
 * Tracks all store-usages as well as all variable declarations and imports in the component.
 *
 * In the modification-step at the end, all variable declartaions and imports which
 * were used as stores are appended with `let $xx = __sveltets_store_get(xx)` to create the store variables.
 */
export class ImplicitStoreValues {
    private accessedStores = new Set<string>();
    private variableDeclarations: ts.VariableDeclaration[] = [];
    private importStatements: Array<ts.ImportClause | ts.ImportSpecifier> = [];

    public addStoreAcess = this.accessedStores.add.bind(this.accessedStores);
    public addVariableDeclaration = this.variableDeclarations.push.bind(this.variableDeclarations);
    public addImportStatement = this.importStatements.push.bind(this.importStatements);

    constructor(storesResolvedInTemplate: string[] = []) {
        storesResolvedInTemplate.forEach(this.addStoreAcess);
    }

    /**
     * All variable declartaions and imports which
     * were used as stores are appended with `let $xx = __sveltets_store_get(xx)` to create the store variables.
     */
    public modifyCode(astOffset: number, str: MagicString) {
        this.variableDeclarations
            .filter(({ name }) => this.accessedStores.has(name.getText()))
            .forEach((node) => this.attachStoreValueDeclarationToDecl(node, astOffset, str));

        this.importStatements
            .filter(({ name }) => name && this.accessedStores.has(name.getText()))
            .forEach((node) => this.attachStoreValueDeclarationToImport(node, astOffset, str));
    }

    private attachStoreValueDeclarationToDecl(
        node: ts.VariableDeclaration,
        astOffset: number,
        str: MagicString
    ) {
        const storeName = node.name.getText();
        if (
            !ts.isVariableDeclarationList(node.parent) ||
            !ts.isVariableStatement(node.parent.parent)
        )
            return;

        const variableStatement = node.parent.parent;

        const endPos = variableStatement.getEnd() + astOffset;
        str.appendRight(endPos, `;let $${storeName} = __sveltets_store_get(${storeName});`);
    }

    private attachStoreValueDeclarationToImport(
        node: ts.ImportClause | ts.ImportSpecifier,
        astOffset: number,
        str: MagicString
    ) {
        const storeName = node.name.getText();
        const importStatement = ts.isImportClause(node) ? node.parent : node.parent.parent.parent;

        const endPos = importStatement.getEnd() + astOffset;
        str.appendRight(endPos, `;let $${storeName} = __sveltets_store_get(${storeName});`);
    }
}
