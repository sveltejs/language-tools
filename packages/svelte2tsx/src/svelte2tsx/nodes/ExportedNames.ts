import ts from 'typescript';
import { getLastLeadingDoc, isInterfaceOrTypeDeclaration } from '../utils/tsAst';

export interface IExportedNames {
    has(name: string): boolean;
}

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

export class ExportedNames extends Map<string, ExportedName> implements IExportedNames {
    private uses$$Props = false;
    private possibleExports = new Map<string, ExportedName>();

    setUses$$Props(): void {
        this.uses$$Props = true;
    }

    /**
     * Marks a top level declaration as a possible export
     * which could be exported through `export { .. }` later.
     */
    addPossibleExport(
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
                isLet,
                type: type?.getText(),
                identifierText: (target as ts.Identifier).text,
                required,
                doc: this.getDoc(target)
            });
        } else {
            this.possibleExports.set(name.text, {
                isLet
            });
        }
    }

    /**
     * Adds export to map
     */
    addExport(
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
            this.set(name.text, {
                isLet: isLet || existingDeclaration?.isLet,
                type: type?.getText() || existingDeclaration?.type,
                identifierText: (target as ts.Identifier).text,
                required: required || existingDeclaration?.required,
                doc: this.getDoc(target) || existingDeclaration?.doc
            });
        } else {
            this.set(name.text, {
                isLet: isLet || existingDeclaration?.isLet,
                type: existingDeclaration?.type,
                required: existingDeclaration?.required,
                doc: existingDeclaration?.doc
            });
        }
    }

    private getDoc(target: ts.BindingName) {
        let doc = undefined;
        // Traverse `a` up to `export let a`
        const exportExpr = target?.parent?.parent?.parent;

        if (exportExpr) {
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
        const names = Array.from(this.entries());

        if (this.uses$$Props) {
            const lets = names.filter(([, { isLet }]) => isLet);
            const others = names.filter(([, { isLet }]) => !isLet);
            // We need to check both ways:
            // - The check if exports are assignable to Parial<$$Props> is necessary to make sure
            //   no props are missing. Partial<$$Props> is needed because props with a default value
            //   count as optional, but semantically speaking it is still correctly implementing the interface
            // - The check if $$Props is assignable to exports is necessary to make sure no extraneous props
            //   are defined and that no props are required that should be optional
            // __sveltets_ensureRightProps needs to be declared in a way that doesn't affect the type result of props
            return (
                '{...__sveltets_ensureRightProps<{' +
                this.createReturnElementsType(lets).join(',') +
                '}>(__sveltets_any("") as $$Props), ' +
                '...__sveltets_ensureRightProps<Partial<$$Props>>({' +
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
        return Array.from(this.entries())
            .filter(([_, entry]) => !entry.required)
            .map(([name, entry]) => `'${entry.identifierText || name}'`);
    }
}
