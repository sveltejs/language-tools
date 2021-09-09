import MagicString from 'magic-string';
import ts from 'typescript';
import { findExportKeyword, getLastLeadingDoc, isInterfaceOrTypeDeclaration } from '../utils/tsAst';

export function is$$PropsDeclaration(
    node: ts.Node
): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
    return isInterfaceOrTypeDeclaration(node) && node.name.text === '$$Props';
}

interface ExportedName {
    isLet: boolean;
    type?: string;
    identifierText?: string;
    required?: boolean;
    doc?: string;
}

export class ExportedNames {
    private uses$$Props = false;
    private exports = new Map<string, ExportedName>();
    private possibleExports = new Map<
        string,
        ExportedName & {
            declaration: ts.VariableDeclarationList;
        }
    >();
    private doneDeclarationTransformation = new Set<ts.VariableDeclarationList>();
    private getters = new Set<string>();

    constructor(private str: MagicString, private astOffset: number) {}

    handleVariableStatement(node: ts.VariableStatement, parent: ts.Node): void {
        const exportModifier = findExportKeyword(node);
        if (exportModifier) {
            const isLet = node.declarationList.flags === ts.NodeFlags.Let;
            const isConst = node.declarationList.flags === ts.NodeFlags.Const;

            this.handleExportedVariableDeclarationList(node.declarationList, (_, ...args) =>
                this.addExport(...args)
            );
            if (isLet) {
                this.propTypeAssertToUserDefined(node.declarationList);
            } else if (isConst) {
                node.declarationList.forEachChild((n) => {
                    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
                        this.addGetter(n.name);
                    }
                });
            }
            this.removeExport(exportModifier.getStart(), exportModifier.end);
        } else if (ts.isSourceFile(parent)) {
            this.handleExportedVariableDeclarationList(
                node.declarationList,
                this.addPossibleExport.bind(this)
            );
        }
    }

    handleExportFunctionOrClass(node: ts.ClassDeclaration | ts.FunctionDeclaration): void {
        const exportModifier = findExportKeyword(node);
        if (!exportModifier) {
            return;
        }

        this.removeExport(exportModifier.getStart(), exportModifier.end);
        this.addGetter(node.name);

        // Can't export default here
        if (node.name) {
            this.addExport(node.name, false);
        }
    }

    handleExportDeclaration(node: ts.ExportDeclaration): void {
        const { exportClause } = node;
        if (ts.isNamedExports(exportClause)) {
            for (const ne of exportClause.elements) {
                if (ne.propertyName) {
                    this.addExport(ne.propertyName, false, ne.name);
                } else {
                    this.addExport(ne.name, false);
                }
            }
            //we can remove entire statement
            this.removeExport(node.getStart(), node.end);
        }
    }

    private removeExport(start: number, end: number) {
        const exportStart = this.str.original.indexOf('export', start + this.astOffset);
        const exportEnd = exportStart + (end - start);
        this.str.remove(exportStart, exportEnd);
    }

    /**
     * Appends `prop = __sveltets_1_any(prop)`  to given declaration in order to
     * trick TS into widening the type. Else for example `let foo: string | undefined = undefined`
     * is narrowed to `undefined` by TS.
     */
    private propTypeAssertToUserDefined(node: ts.VariableDeclarationList) {
        if (this.doneDeclarationTransformation.has(node)) {
            return;
        }

        const hasInitializers = node.declarations.filter((declaration) => declaration.initializer);
        const handleTypeAssertion = (declaration: ts.VariableDeclaration) => {
            const identifier = declaration.name;
            const tsType = declaration.type;
            const jsDocType = ts.getJSDocType(declaration);
            const type = tsType || jsDocType;

            if (
                !ts.isIdentifier(identifier) ||
                (!type &&
                    // Edge case: TS infers `export let bla = false` to type `false`.
                    // prevent that by adding the any-wrap in this case, too.
                    ![ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.TrueKeyword].includes(
                        declaration.initializer?.kind
                    ))
            ) {
                return;
            }
            const name = identifier.getText();
            const end = declaration.end + this.astOffset;

            this.str.appendLeft(end, `;${name} = __sveltets_1_any(${name});`);
        };

        const findComma = (target: ts.Node) =>
            target.getChildren().filter((child) => child.kind === ts.SyntaxKind.CommaToken);
        const splitDeclaration = () => {
            const commas = node
                .getChildren()
                .filter((child) => child.kind === ts.SyntaxKind.SyntaxList)
                .map(findComma)
                .reduce((current, previous) => [...current, ...previous], []);

            commas.forEach((comma) => {
                const start = comma.getStart() + this.astOffset;
                const end = comma.getEnd() + this.astOffset;
                this.str.overwrite(start, end, ';let ', { contentOnly: true });
            });
        };
        splitDeclaration();

        for (const declaration of hasInitializers) {
            handleTypeAssertion(declaration);
        }
        this.doneDeclarationTransformation.add(node);
    }

    private handleExportedVariableDeclarationList(
        list: ts.VariableDeclarationList,
        add: ExportedNames['addPossibleExport']
    ) {
        const isLet = list.flags === ts.NodeFlags.Let;
        ts.forEachChild(list, (node) => {
            if (ts.isVariableDeclaration(node)) {
                if (ts.isIdentifier(node.name)) {
                    add(list, node.name, isLet, node.name, node.type, !node.initializer);
                } else if (
                    ts.isObjectBindingPattern(node.name) ||
                    ts.isArrayBindingPattern(node.name)
                ) {
                    ts.forEachChild(node.name, (element) => {
                        if (ts.isBindingElement(element)) {
                            add(list, element.name, isLet);
                        }
                    });
                }
            }
        });
    }

    private addGetter(node: ts.Identifier): void {
        if (!node) {
            return;
        }
        this.getters.add(node.text);
    }

    createClassGetters(): string {
        return Array.from(this.getters)
            .map((name) => `\n    get ${name}() { return render().getters.${name} }`)
            .join('');
    }

    createRenderFunctionGetterStr(): string {
        const properties = Array.from(this.getters).map((name) => `${name}: ${name}`);
        return `{${properties.join(', ')}}`;
    }

    createClassAccessors(): string {
        const accessors: string[] = [];
        for (const value of this.exports.values()) {
            if (this.getters.has(value.identifierText)) {
                continue;
            }

            accessors.push(value.identifierText);
        }

        return accessors
            .map(
                (name) =>
                    `\n    get ${name}() { return render().props.${name} }` +
                    `\n    /**accessor*/\n    set ${name}(_) {}`
            )
            .join('');
    }

    setUses$$Props(): void {
        this.uses$$Props = true;
    }

    /**
     * Marks a top level declaration as a possible export
     * which could be exported through `export { .. }` later.
     */
    private addPossibleExport(
        declaration: ts.VariableDeclarationList,
        name: ts.BindingName,
        isLet: boolean,
        target: ts.BindingName = null,
        type: ts.TypeNode = null,
        required = false
    ) {
        if (!ts.isIdentifier(name)) {
            return;
        }

        if (target && ts.isIdentifier(target)) {
            this.possibleExports.set(name.text, {
                declaration,
                isLet,
                type: type?.getText(),
                identifierText: (target as ts.Identifier).text,
                required,
                doc: this.getDoc(target)
            });
        } else {
            this.possibleExports.set(name.text, {
                declaration,
                isLet
            });
        }
    }

    /**
     * Adds export to map
     */
    private addExport(
        name: ts.BindingName,
        isLet: boolean,
        target: ts.BindingName = null,
        type: ts.TypeNode = null,
        required = false
    ): void {
        if (name.kind != ts.SyntaxKind.Identifier) {
            throw Error('export source kind not supported ' + name);
        }
        if (target && target.kind != ts.SyntaxKind.Identifier) {
            throw Error('export target kind not supported ' + target);
        }

        const existingDeclaration = this.possibleExports.get(name.text);

        if (target) {
            this.exports.set(name.text, {
                isLet: isLet || existingDeclaration?.isLet,
                type: type?.getText() || existingDeclaration?.type,
                identifierText: (target as ts.Identifier).text,
                required: required || existingDeclaration?.required,
                doc: this.getDoc(target) || existingDeclaration?.doc
            });
        } else {
            this.exports.set(name.text, {
                isLet: isLet || existingDeclaration?.isLet,
                type: existingDeclaration?.type,
                required: existingDeclaration?.required,
                doc: existingDeclaration?.doc
            });
        }

        if (existingDeclaration?.isLet) {
            this.propTypeAssertToUserDefined(existingDeclaration.declaration);
        }
    }

    private getDoc(target: ts.BindingName) {
        let doc = undefined;
        // Traverse `a` one up. If the declaration is part of a declaration list,
        // the comment is at this point already
        const variableDeclaration = target?.parent;
        // Traverse `a` up to `export let a`
        const exportExpr = target?.parent?.parent?.parent;

        if (variableDeclaration) {
            doc = getLastLeadingDoc(variableDeclaration);
        }

        if (exportExpr && !doc) {
            doc = getLastLeadingDoc(exportExpr);
        }

        return doc;
    }

    /**
     * Creates a string from the collected props
     *
     * @param isTsFile Whether this is a TypeScript file or not.
     */
    createPropsStr(isTsFile: boolean): string {
        const names = Array.from(this.exports.entries());

        if (this.uses$$Props) {
            const lets = names.filter(([, { isLet }]) => isLet);
            const others = names.filter(([, { isLet }]) => !isLet);
            // We need to check both ways:
            // - The check if exports are assignable to Parial<$$Props> is necessary to make sure
            //   no props are missing. Partial<$$Props> is needed because props with a default value
            //   count as optional, but semantically speaking it is still correctly implementing the interface
            // - The check if $$Props is assignable to exports is necessary to make sure no extraneous props
            //   are defined and that no props are required that should be optional
            // __sveltets_1_ensureRightProps needs to be declared in a way that doesn't affect the type result of props
            return (
                '{...__sveltets_1_ensureRightProps<{' +
                this.createReturnElementsType(lets).join(',') +
                '}>(__sveltets_1_any("") as $$Props), ' +
                '...__sveltets_1_ensureRightProps<Partial<$$Props>>({' +
                this.createReturnElements(lets, false).join(',') +
                '}), ...{} as unknown as $$Props, ...{' +
                this.createReturnElements(others, false).join(', ') +
                '} as {' +
                this.createReturnElementsType(others).join(',') +
                '}}'
            );
        }

        const dontAddTypeDef =
            !isTsFile ||
            names.length === 0 ||
            names.every(([_, value]) => !value.type && value.required);
        const returnElements = this.createReturnElements(names, dontAddTypeDef);
        if (dontAddTypeDef) {
            // No exports or only `typeof` exports -> omit the `as {...}` completely.
            // If not TS, omit the types to not have a "cannot use types in jsx" error.
            return `{${returnElements.join(' , ')}}`;
        }

        const returnElementsType = this.createReturnElementsType(names);
        return `{${returnElements.join(' , ')}} as {${returnElementsType.join(', ')}}`;
    }

    private createReturnElements(
        names: Array<[string, ExportedName]>,
        dontAddTypeDef: boolean
    ): string[] {
        return names.map(([key, value]) => {
            // Important to not use shorthand props for rename functionality
            return `${dontAddTypeDef && value.doc ? `\n${value.doc}` : ''}${
                value.identifierText || key
            }: ${key}`;
        });
    }

    private createReturnElementsType(names: Array<[string, ExportedName]>) {
        return names.map(([key, value]) => {
            const identifier = `${value.doc ? `\n${value.doc}` : ''}${value.identifierText || key}${
                value.required ? '' : '?'
            }`;
            if (!value.type) {
                return `${identifier}: typeof ${key}`;
            }

            return `${identifier}: ${value.type}`;
        });
    }

    createOptionalPropsArray(): string[] {
        return Array.from(this.exports.entries())
            .filter(([_, entry]) => !entry.required)
            .map(([name, entry]) => `'${entry.identifierText || name}'`);
    }

    getExportsMap() {
        return this.exports;
    }
}
