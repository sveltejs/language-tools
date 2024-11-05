import MagicString from 'magic-string';
import ts from 'typescript';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { getCurrentPrepends, preprendStr } from '../../utils/magic-string';
import { extractIdentifiers, getNamesFromLabeledStatement } from '../utils/tsAst';

/**
 * Tracks all store-usages as well as all variable declarations and imports in the component.
 *
 * In the modification-step at the end, all variable declarations and imports which
 * were used as stores are appended with `let $xx = __sveltets_2_store_get(xx)` to create the store variables.
 */
export class ImplicitStoreValues {
    private accessedStores = new Set<string>();
    private variableDeclarations: ts.VariableDeclaration[] = [];
    private reactiveDeclarations: ts.LabeledStatement[] = [];
    private importStatements: Array<ts.ImportClause | ts.ImportSpecifier> = [];

    public addStoreAcess = this.accessedStores.add.bind(this.accessedStores);
    public addVariableDeclaration = this.variableDeclarations.push.bind(this.variableDeclarations);
    public addReactiveDeclaration = this.reactiveDeclarations.push.bind(this.reactiveDeclarations);
    public addImportStatement = this.importStatements.push.bind(this.importStatements);

    constructor(
        storesResolvedInTemplate: string[] = [],
        private renderFunctionStart: number,
        private storeFromImportsWrapper = (input: string) => input
    ) {
        storesResolvedInTemplate.forEach(this.addStoreAcess);
    }

    /**
     * All variable declartaions and imports which
     * were used as stores are appended with `let $xx = __sveltets_2_store_get(xx)` to create the store variables.
     */
    public modifyCode(astOffset: number, str: MagicString) {
        this.variableDeclarations.forEach((node) =>
            this.attachStoreValueDeclarationToDecl(node, astOffset, str)
        );

        this.reactiveDeclarations.forEach((node) =>
            this.attachStoreValueDeclarationToReactiveAssignment(node, astOffset, str)
        );

        this.attachStoreValueDeclarationOfImportsToRenderFn(str);
    }

    public getAccessedStores(): string[] {
        return [...this.accessedStores.keys()];
    }

    public getGlobals(): string[] {
        const globals = new Set<string>(this.accessedStores);
        this.variableDeclarations.forEach((node) =>
            extractIdentifiers(node.name).forEach((id) => globals.delete(id.text))
        );
        this.reactiveDeclarations.forEach((node) =>
            getNamesFromLabeledStatement(node).forEach((name) => globals.delete(name))
        );
        this.importStatements.forEach(({ name }) => name && globals.delete(name.getText()));
        return [...globals].map((name) => `$${name}`);
    }

    private attachStoreValueDeclarationToDecl(
        node: ts.VariableDeclaration,
        astOffset: number,
        str: MagicString
    ) {
        const storeNames = extractIdentifiers(node.name)
            .map((id) => id.text)
            .filter((name) => this.accessedStores.has(name));
        if (!storeNames.length) {
            return;
        }

        const storeDeclarations = surroundWithIgnoreComments(
            this.createStoreDeclarations(storeNames)
        );
        const nodeEnd =
            ts.isVariableDeclarationList(node.parent) && node.parent.declarations.length > 1
                ? node.parent.declarations[node.parent.declarations.length - 1].getEnd()
                : node.getEnd();

        // Quick-fixing https://github.com/sveltejs/language-tools/issues/1950
        // TODO think about a SourceMap-wrapper that does these things for us,
        // or investigate altering the inner workings of SourceMap, or investigate
        // if we can always use prependStr here (and elsewhere, too)
        if (getCurrentPrepends(str, nodeEnd + astOffset).length) {
            preprendStr(str, nodeEnd + astOffset, storeDeclarations);
        } else {
            str.appendRight(nodeEnd + astOffset, storeDeclarations);
        }
    }

    private attachStoreValueDeclarationToReactiveAssignment(
        node: ts.LabeledStatement,
        astOffset: number,
        str: MagicString
    ) {
        const storeNames = getNamesFromLabeledStatement(node).filter((name) =>
            this.accessedStores.has(name)
        );
        if (!storeNames.length) {
            return;
        }

        const storeDeclarations = surroundWithIgnoreComments(
            this.createStoreDeclarations(storeNames)
        );
        const endPos = node.getEnd() + astOffset;

        // Quick-fixing https://github.com/sveltejs/language-tools/issues/1097
        // TODO think about a SourceMap-wrapper that does these things for us,
        // or investigate altering the inner workings of SourceMap, or investigate
        // if we can always use prependStr here (and elsewhere, too)
        if (str.original.charAt(endPos - 1) !== ';') {
            preprendStr(str, endPos, storeDeclarations);
        } else {
            str.appendRight(endPos, storeDeclarations);
        }
    }

    private attachStoreValueDeclarationOfImportsToRenderFn(str: MagicString) {
        const storeNames = this.importStatements
            .filter(({ name }) => name && this.accessedStores.has(name.getText()))
            .map(({ name }) => name.getText());
        if (!storeNames.length) {
            return;
        }

        const storeDeclarations = this.storeFromImportsWrapper(
            surroundWithIgnoreComments(this.createStoreDeclarations(storeNames))
        );

        str.appendRight(this.renderFunctionStart, storeDeclarations);
    }

    private createStoreDeclarations(storeNames: string[]): string {
        let declarations = '';
        for (let i = 0; i < storeNames.length; i++) {
            declarations += this.createStoreDeclaration(storeNames[i]);
        }
        return declarations;
    }

    private createStoreDeclaration(storeName: string): string {
        return `;let $${storeName} = __sveltets_2_store_get(${storeName});`;
    }
}
