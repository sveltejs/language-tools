import ts from 'typescript';
import MagicString from 'magic-string';

/**
 * Collects all imports and module-level declarations to then find out which interfaces/types are hoistable.
 */
export class HoistableInterfaces {
    private import_value_set: Set<string> = new Set();
    private import_type_set: Set<string> = new Set();
    private interface_map: Map<
        string,
        { type_deps: Set<string>; value_deps: Set<string>; node: ts.Node }
    > = new Map();
    private props_interface = {
        name: '',
        node: null as ts.Node | null,
        type_deps: new Set<string>(),
        value_deps: new Set<string>()
    };

    analyzeModuleScriptNode(node: ts.Node) {
        // Handle Import Declarations
        if (ts.isImportDeclaration(node) && node.importClause) {
            const is_type_only = node.importClause.isTypeOnly;

            if (
                node.importClause.namedBindings &&
                ts.isNamedImports(node.importClause.namedBindings)
            ) {
                node.importClause.namedBindings.elements.forEach((element) => {
                    const import_name = element.name.text;
                    if (is_type_only || element.isTypeOnly) {
                        this.import_type_set.add(import_name);
                    } else {
                        this.import_value_set.add(import_name);
                    }
                });
            }

            // Handle default imports
            if (node.importClause.name) {
                const default_import = node.importClause.name.text;
                if (is_type_only) {
                    this.import_type_set.add(default_import);
                } else {
                    this.import_value_set.add(default_import);
                }
            }

            // Handle namespace imports
            if (
                node.importClause.namedBindings &&
                ts.isNamespaceImport(node.importClause.namedBindings)
            ) {
                const namespace_import = node.importClause.namedBindings.name.text;
                if (is_type_only) {
                    this.import_type_set.add(namespace_import);
                } else {
                    this.import_value_set.add(namespace_import);
                }
            }
        }

        // Handle top-level declarations
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach((declaration) => {
                if (ts.isIdentifier(declaration.name)) {
                    this.import_value_set.add(declaration.name.text);
                }
            });
        }

        if (ts.isFunctionDeclaration(node) && node.name) {
            this.import_value_set.add(node.name.text);
        }

        if (ts.isClassDeclaration(node) && node.name) {
            this.import_value_set.add(node.name.text);
        }

        if (ts.isEnumDeclaration(node)) {
            this.import_value_set.add(node.name.text);
        }

        if (ts.isTypeAliasDeclaration(node)) {
            this.import_type_set.add(node.name.text);
        }

        if (ts.isInterfaceDeclaration(node)) {
            this.import_type_set.add(node.name.text);
        }
    }

    analyzeInstanceScriptNode(node: ts.Node) {
        // Handle Import Declarations
        if (ts.isImportDeclaration(node) && node.importClause) {
            const is_type_only = node.importClause.isTypeOnly;

            if (
                node.importClause.namedBindings &&
                ts.isNamedImports(node.importClause.namedBindings)
            ) {
                node.importClause.namedBindings.elements.forEach((element) => {
                    const import_name = element.name.text;
                    if (is_type_only) {
                        this.import_type_set.add(import_name);
                    } else {
                        this.import_value_set.add(import_name);
                    }
                });
            }

            // Handle default imports
            if (node.importClause.name) {
                const default_import = node.importClause.name.text;
                if (is_type_only) {
                    this.import_type_set.add(default_import);
                } else {
                    this.import_value_set.add(default_import);
                }
            }

            // Handle namespace imports
            if (
                node.importClause.namedBindings &&
                ts.isNamespaceImport(node.importClause.namedBindings)
            ) {
                const namespace_import = node.importClause.namedBindings.name.text;
                if (is_type_only) {
                    this.import_type_set.add(namespace_import);
                } else {
                    this.import_value_set.add(namespace_import);
                }
            }
        }

        // Handle Interface Declarations
        if (ts.isInterfaceDeclaration(node)) {
            const interface_name = node.name.text;
            const type_dependencies: Set<string> = new Set();
            const value_dependencies: Set<string> = new Set();
            const generics = node.typeParameters?.map((param) => param.name.text) ?? [];

            node.members.forEach((member) => {
                if (ts.isPropertySignature(member) && member.type) {
                    this.collectTypeDependencies(
                        member.type,
                        type_dependencies,
                        value_dependencies,
                        generics
                    );
                } else if (ts.isIndexSignatureDeclaration(member)) {
                    this.collectTypeDependencies(
                        member.type,
                        type_dependencies,
                        value_dependencies,
                        generics
                    );
                    member.parameters.forEach((param) => {
                        this.collectTypeDependencies(
                            param.type,
                            type_dependencies,
                            value_dependencies,
                            generics
                        );
                    });
                }
            });

            if (this.import_type_set.has(interface_name)) {
                // shadowed; delete because we can't hoist
                this.import_type_set.delete(interface_name);
            } else {
                this.interface_map.set(interface_name, {
                    type_deps: type_dependencies,
                    value_deps: value_dependencies,
                    node
                });
            }
        }

        // Handle Type Alias Declarations
        if (ts.isTypeAliasDeclaration(node)) {
            const alias_name = node.name.text;
            const type_dependencies: Set<string> = new Set();
            const value_dependencies: Set<string> = new Set();
            const generics = node.typeParameters?.map((param) => param.name.text) ?? [];

            this.collectTypeDependencies(
                node.type,
                type_dependencies,
                value_dependencies,
                generics
            );

            if (this.import_type_set.has(alias_name)) {
                // shadowed; delete because we can't hoist
                this.import_type_set.delete(alias_name);
            } else {
                this.interface_map.set(alias_name, {
                    type_deps: type_dependencies,
                    value_deps: value_dependencies,
                    node
                });
            }
        }

        // Handle top-level declarations: They could shadow module declarations; delete them from the set of allowed import values
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach((declaration) => {
                if (ts.isIdentifier(declaration.name)) {
                    this.import_value_set.delete(declaration.name.text);
                }
            });
        }

        if (ts.isFunctionDeclaration(node) && node.name) {
            this.import_value_set.delete(node.name.text);
        }

        if (ts.isClassDeclaration(node) && node.name) {
            this.import_value_set.delete(node.name.text);
        }

        if (ts.isEnumDeclaration(node)) {
            this.import_value_set.delete(node.name.text);
        }

        if (ts.isTypeAliasDeclaration(node)) {
            this.import_type_set.delete(node.name.text);
        }

        if (ts.isInterfaceDeclaration(node)) {
            this.import_type_set.delete(node.name.text);
        }
    }

    analyze$propsRune(
        node: ts.VariableDeclaration & {
            initializer: ts.CallExpression & { expression: ts.Identifier };
        }
    ) {
        if (node.initializer.typeArguments?.length > 0 || node.type) {
            const generic_arg = node.initializer.typeArguments?.[0] || node.type;
            if (ts.isTypeReferenceNode(generic_arg)) {
                const name = this.getEntityNameText(generic_arg.typeName);
                const interface_node = this.interface_map.get(name);
                if (interface_node) {
                    this.props_interface.name = name;
                    this.props_interface.type_deps = interface_node.type_deps;
                    this.props_interface.value_deps = interface_node.value_deps;
                }
            } else {
                this.props_interface.name = '$$ComponentProps';
                this.props_interface.node = generic_arg;
                this.collectTypeDependencies(
                    generic_arg,
                    this.props_interface.type_deps,
                    this.props_interface.value_deps,
                    []
                );
            }
        }
    }

    /**
     * Traverses the AST to collect import statements and top-level interfaces,
     * then determines which interfaces can be hoisted.
     * @param source_file The TypeScript source file to analyze.
     * @returns An object containing sets of value imports, type imports, and hoistable interfaces.
     */
    private determineHoistableInterfaces() {
        const hoistable_interfaces: Map<string, ts.Node> = new Map();
        let progress = true;

        while (progress) {
            progress = false;

            for (const [interface_name, deps] of this.interface_map.entries()) {
                if (hoistable_interfaces.has(interface_name)) {
                    continue;
                }

                const can_hoist = [...deps.type_deps, ...deps.value_deps].every((dep) => {
                    return (
                        this.import_type_set.has(dep) ||
                        this.import_value_set.has(dep) ||
                        hoistable_interfaces.has(dep)
                    );
                });

                if (can_hoist) {
                    hoistable_interfaces.set(interface_name, deps.node);
                    progress = true;
                }
            }
        }

        if (this.props_interface.name === '$$ComponentProps') {
            const can_hoist = [
                ...this.props_interface.type_deps,
                ...this.props_interface.value_deps
            ].every((dep) => {
                return (
                    this.import_type_set.has(dep) ||
                    this.import_value_set.has(dep) ||
                    hoistable_interfaces.has(dep)
                );
            });

            if (can_hoist) {
                hoistable_interfaces.set(this.props_interface.name, this.props_interface.node);
            }
        }

        return hoistable_interfaces;
    }

    /**
     * Moves all interfaces that can be hoisted to the top of the script, if the $props rune's type is hoistable.
     */
    moveHoistableInterfaces(
        str: MagicString,
        astOffset: number,
        scriptStart: number,
        generics: string[]
    ) {
        if (!this.props_interface.name) return;

        for (const generic of generics) {
            this.import_type_set.delete(generic);
        }

        const hoistable = this.determineHoistableInterfaces();

        if (hoistable.has(this.props_interface.name)) {
            for (const [name, node] of hoistable) {
                let pos = node.pos + astOffset;

                if (name === '$$ComponentProps') {
                    // So that organize imports doesn't mess with the types
                    str.prependRight(pos, '\n');
                } else {
                    // node.pos includes preceeding whitespace, which could mean we accidentally also move stuff appended to a previous node
                    if (str.original[pos] === '\r') {
                        pos++;
                    }
                    if (/\s/.test(str.original[pos])) {
                        pos++;
                    }

                    // jsdoc comments would be ignored if they are on the same line as the ;, so we add a newline, too.
                    // Also helps with organize imports not messing with the types
                    str.prependRight(pos, ';\n');
                    str.appendLeft(node.end + astOffset, ';');
                }

                str.move(pos, node.end + astOffset, scriptStart);
            }

            return hoistable;
        }
    }

    getAllowedValues() {
        return this.import_value_set;
    }

    /**
     * Collects type and value dependencies from a given TypeNode.
     * @param type_node The TypeNode to analyze.
     * @param type_dependencies The set to collect type dependencies into.
     * @param value_dependencies The set to collect value dependencies into.
     */
    private collectTypeDependencies(
        type_node: ts.TypeNode,
        type_dependencies: Set<string>,
        value_dependencies: Set<string>,
        generics: string[]
    ) {
        const walk = (node: ts.Node) => {
            if (ts.isTypeReferenceNode(node)) {
                const type_name = this.getEntityNameText(node.typeName);
                if (!generics.includes(type_name)) {
                    type_dependencies.add(type_name);
                }
            } else if (ts.isTypeQueryNode(node)) {
                // Handle 'typeof' expressions: e.g., foo: typeof bar
                value_dependencies.add(this.getEntityNameText(node.exprName));
            }

            ts.forEachChild(node, walk);
        };

        walk(type_node);
    }

    /**
     * Retrieves the full text of an EntityName (handles nested names).
     * @param entity_name The EntityName to extract text from.
     * @returns The full name as a string.
     */
    private getEntityNameText(entity_name: ts.EntityName): string {
        if (ts.isIdentifier(entity_name)) {
            return entity_name.text;
        } else {
            return this.getEntityNameText(entity_name.left) + '.' + entity_name.right.text;
        }
    }
}
