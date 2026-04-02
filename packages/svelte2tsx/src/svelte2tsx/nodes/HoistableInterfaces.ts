import ts from 'typescript';
import MagicString from 'magic-string';

/**
 * Collects all imports and module-level declarations to then find out which interfaces/types are hoistable.
 */
export class HoistableInterfaces {
    private module_types: Set<string> = new Set();
    private disallowed_types = new Set<string>();
    private disallowed_values = new Set<string>();
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

    analyzeSnippets(
        rootSnippets: [start: number, end: number, globals: Map<string, any>, string][]
    ) {
        let prev_disallowed_values_size;
        // we need to recalculate the disallowed values until they are stable because
        // one snippet might depend on another snippet which was previously hoistable
        while (
            prev_disallowed_values_size == null ||
            this.disallowed_values.size !== prev_disallowed_values_size
        ) {
            prev_disallowed_values_size = this.disallowed_values.size;
            for (const [, , globals, name] of rootSnippets) {
                const hoist_to_module =
                    globals.size === 0 ||
                    [...globals.keys()].every((id) => this.isAllowedReference(id));
                if (!hoist_to_module) {
                    this.disallowed_values.add(name);
                }
            }
        }
    }

    /** should be called before analyzeInstanceScriptNode */
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
                        this.module_types.add(import_name);
                    }
                });
            }

            // Handle default imports
            if (node.importClause.name) {
                const default_import = node.importClause.name.text;
                if (is_type_only) {
                    this.module_types.add(default_import);
                }
            }

            // Handle namespace imports
            if (
                node.importClause.namedBindings &&
                ts.isNamespaceImport(node.importClause.namedBindings)
            ) {
                const namespace_import = node.importClause.namedBindings.name.text;
                if (is_type_only) {
                    this.module_types.add(namespace_import);
                }
            }
        }

        if (ts.isTypeAliasDeclaration(node)) {
            this.module_types.add(node.name.text);
        }

        if (ts.isInterfaceDeclaration(node)) {
            this.module_types.add(node.name.text);
        }

        if (ts.isEnumDeclaration(node)) {
            this.module_types.add(node.name.text);
        }

        if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
            this.module_types.add(node.name.text);
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
                        this.module_types.add(import_name);
                    }
                });
            }

            // Handle default imports
            if (node.importClause.name) {
                const default_import = node.importClause.name.text;
                if (is_type_only) {
                    this.module_types.add(default_import);
                }
            }

            // Handle namespace imports
            if (
                node.importClause.namedBindings &&
                ts.isNamespaceImport(node.importClause.namedBindings)
            ) {
                const namespace_import = node.importClause.namedBindings.name.text;
                if (is_type_only) {
                    this.module_types.add(namespace_import);
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

            node.heritageClauses?.forEach((clause) => {
                clause.types.forEach((type) => {
                    if (ts.isIdentifier(type.expression)) {
                        const type_name = type.expression.text;
                        if (!generics.includes(type_name)) {
                            type_dependencies.add(type_name);
                        }
                    }

                    this.collectTypeDependencies(
                        type,
                        type_dependencies,
                        value_dependencies,
                        generics
                    );
                });
            });

            if (this.module_types.has(interface_name)) {
                // shadowed; we can't hoist
                this.disallowed_types.add(interface_name);
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

            if (this.module_types.has(alias_name)) {
                // shadowed; we can't hoist
                this.disallowed_types.add(alias_name);
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
                    this.disallowed_values.add(declaration.name.text);
                } else {
                    const walk = (node: ts.Node) => {
                        if (
                            ts.isIdentifier(node) &&
                            ts.isBindingElement(node.parent) &&
                            node.parent.name === node
                        ) {
                            this.disallowed_values.add(node.text);
                        }
                        ts.forEachChild(node, walk);
                    };

                    walk(declaration.name);
                }
            });
        }

        if (ts.isFunctionDeclaration(node) && node.name) {
            this.disallowed_values.add(node.name.text);
        }

        if (ts.isClassDeclaration(node) && node.name) {
            this.disallowed_values.add(node.name.text);
        }

        if (ts.isEnumDeclaration(node)) {
            this.disallowed_values.add(node.name.text);
        }

        // namespace declaration should not be in the instance script.
        // Only adding the top-level name to the disallowed list,
        // so that at least there won't a confusing error message of "can't find namespace Foo"
        if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
            this.disallowed_types.add(node.name.text);
            this.disallowed_values.add(node.name.text);
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
                const name = this.getEntityNameRoot(generic_arg.typeName);
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

    addDisallowed(names: string[]) {
        for (const name of names) {
            this.disallowed_values.add(name);
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

                let can_hoist = true;

                for (const dep of deps.type_deps) {
                    if (this.disallowed_types.has(dep)) {
                        this.disallowed_types.add(interface_name);
                        can_hoist = false;
                        break;
                    }
                    if (this.interface_map.has(dep) && !hoistable_interfaces.has(dep)) {
                        can_hoist = false;
                    }
                }

                for (const dep of deps.value_deps) {
                    if (!this.isAllowedReference(dep)) {
                        this.disallowed_types.add(interface_name);
                        can_hoist = false;
                        break;
                    }
                }

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
                return !this.disallowed_types.has(dep) && this.isAllowedReference(dep);
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
            this.disallowed_types.add(generic);
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

    isAllowedReference(reference: string) {
        return !(
            this.disallowed_values.has(reference) ||
            reference === '$$props' ||
            reference === '$$restProps' ||
            reference === '$$slots' ||
            // could be a $store reference
            (reference[0] === '$' &&
                reference[1] !== '$' &&
                this.disallowed_values.has(reference.slice(1)))
        );
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
                const type_name = this.getEntityNameRoot(node.typeName);
                if (!generics.includes(type_name)) {
                    type_dependencies.add(type_name);
                }
            } else if (ts.isTypeQueryNode(node)) {
                // Handle 'typeof' expressions: e.g., foo: typeof bar
                value_dependencies.add(this.getEntityNameRoot(node.exprName));
            }

            ts.forEachChild(node, walk);
        };

        walk(type_node);
    }

    /**
     * Retrieves the top-level variable/namespace of an EntityName (handles nested names).
     * ex: `foo.bar.baz` -> `foo`
     * @param entity_name The EntityName to extract text from.
     * @returns The top-level name as a string.
     */
    private getEntityNameRoot(entity_name: ts.EntityName): string {
        if (ts.isIdentifier(entity_name)) {
            return entity_name.text;
        } else {
            return this.getEntityNameRoot(entity_name.left);
        }
    }
}
