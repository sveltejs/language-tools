import MagicString from 'magic-string';
import ts from 'typescript';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { preprendStr, overwriteStr } from '../../utils/magic-string';
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
    /**
     * Uses the $$Props type
     */
    public uses$$Props = false;
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
     * Appends `prop = __sveltets_2_any(prop)`  to given declaration in order to
     * trick TS into widening the type. Else for example `let foo: string | undefined = undefined`
     * is narrowed to `undefined` by TS.
     */
    private propTypeAssertToUserDefined(node: ts.VariableDeclarationList) {
        if (this.doneDeclarationTransformation.has(node)) {
            return;
        }

        const handleTypeAssertion = (declaration: ts.VariableDeclaration) => {
            const identifier = declaration.name;
            const tsType = declaration.type;
            const jsDocType = ts.getJSDocType(declaration);
            const type = tsType || jsDocType;

            if (
                ts.isIdentifier(identifier) &&
                // Ensure initialization for proper control flow and to avoid "possibly undefined" type errors.
                // Also ensure prop is typed as any with a type annotation in TS strict mode
                (!declaration.initializer ||
                    // Widen the type, else it's narrowed to the initializer
                    type ||
                    // Edge case: TS infers `export let bla = false` to type `false`.
                    // prevent that by adding the any-wrap in this case, too.
                    (!type &&
                        [ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.TrueKeyword].includes(
                            declaration.initializer.kind
                        )))
            ) {
                const name = identifier.getText();
                const end = declaration.end + this.astOffset;

                preprendStr(
                    this.str,
                    end,
                    surroundWithIgnoreComments(`;${name} = __sveltets_2_any(${name});`)
                );
            }
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

                overwriteStr(this.str, start, end, ';let ');
            });
        };

        for (const declaration of node.declarations) {
            handleTypeAssertion(declaration);
        }

        // need to be append after the type assert treatment
        splitDeclaration();

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
            .map(
                (name) =>
                    // getters are const/classes/functions, which are always defined.
                    // We have to remove the `| undefined` from the type here because it was necessary to
                    // be added in a previous step so people are not expected to provide these as props.
                    `\n    get ${name}() { return __sveltets_2_nonNullable(this.$$prop_def.${name}) }`
            )
            .join('');
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
                    `\n    get ${name}() { return this.$$prop_def.${name} }` +
                    `\n    /**accessor*/\n    set ${name}(_) {}`
            )
            .join('');
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
     * @param uses$$propsValue whether the file references the $$props variable
     */
    createPropsStr(isTsFile: boolean, uses$$propsValue: boolean): string {
        const names = Array.from(this.exports.entries());

        if (this.uses$$Props) {
            const lets = names.filter(([, { isLet }]) => isLet);
            const others = names.filter(([, { isLet }]) => !isLet);
            // We need to check both ways:
            // - The check if exports are assignable to $$Props is necessary to make sure
            //   no props are missing. Use Partial<$$Props> in case $$props is used.
            // - The check if $$Props is assignable to exports is necessary to make sure no extraneous props
            //   are defined and that no props are required that should be optional
            // __sveltets_2_ensureRightProps needs to be declared in a way that doesn't affect the type result of props
            return (
                '{...__sveltets_2_ensureRightProps<{' +
                this.createReturnElementsType(lets).join(',') +
                '}>(__sveltets_2_any("") as $$Props), ' +
                '...__sveltets_2_ensureRightProps<' +
                (uses$$propsValue ? 'Partial<$$Props>' : '$$Props') +
                '>({' +
                this.createReturnElements(lets, false).join(',') +
                '}), ...{} as unknown as $$Props, ...{' +
                // We add other exports of classes and functions here because
                // they need to appear in the props object in order to properly
                // type bind:xx but they are not needed to be part of $$Props
                this.createReturnElements(others, false).join(', ') +
                '} as {' +
                this.createReturnElementsType(others).join(',') +
                '}}'
            );
        }

        if (names.length === 0 && !uses$$propsValue) {
            // Necessary, because {} roughly equals to any
            return isTsFile
                ? '{} as Record<string, never>'
                : '/** @type {Record<string, never>} */ ({})';
        }

        const dontAddTypeDef =
            !isTsFile || names.every(([_, value]) => !value.type && value.required);
        const returnElements = this.createReturnElements(names, dontAddTypeDef);
        if (dontAddTypeDef) {
            // Only `typeof` exports -> omit the `as {...}` completely.
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
