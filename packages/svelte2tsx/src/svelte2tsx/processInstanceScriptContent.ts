import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import * as ts from 'typescript';
import {
    findExportKeyword,
    getBinaryAssignmentExpr,
    isNotPropertyNameOfImport
} from './utils/tsAst';
import { ExportedNames } from './nodes/ExportedNames';
import { ImplicitTopLevelNames } from './nodes/ImplicitTopLevelNames';
import { ComponentEvents } from './nodes/ComponentEvents';
import { Scope } from './utils/Scope';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    events: ComponentEvents;
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    getters: Set<string>;
}

type PendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
};

export function processInstanceScriptContent(
    str: MagicString,
    script: Node,
    events: ComponentEvents,
    implicitStoreValues: ImplicitStoreValues
): InstanceScriptProcessResult {
    const htmlx = str.original;
    const scriptContent = htmlx.substring(script.content.start, script.content.end);
    const tsAst = ts.createSourceFile(
        'component.ts.svelte',
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const astOffset = script.content.start;
    const exportedNames = new ExportedNames();
    const getters = new Set<string>();

    const implicitTopLevelNames = new ImplicitTopLevelNames();
    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;

    //track if we are in a declaration scope
    let isDeclaration = false;

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $
    const pendingStoreResolutions: Array<PendingStoreResolution<ts.Node>> = [];

    let scope = new Scope();
    const rootScope = scope;

    const pushScope = () => (scope = new Scope(scope));
    const popScope = () => (scope = scope.parent);

    const addGetter = (node: ts.Identifier) => {
        if (!node) {
            return;
        }
        getters.add(node.text);
    };

    const removeExport = (start: number, end: number) => {
        const exportStart = str.original.indexOf('export', start + astOffset);
        const exportEnd = exportStart + (end - start);
        str.remove(exportStart, exportEnd);
    };

    const propTypeAssertToUserDefined = (node: ts.VariableDeclarationList) => {
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
            const end = declaration.end + astOffset;

            str.appendLeft(end, `;${name} = __sveltets_any(${name});`);
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
                const start = comma.getStart() + astOffset;
                const end = comma.getEnd() + astOffset;
                str.overwrite(start, end, ';let ', { contentOnly: true });
            });
        };
        splitDeclaration();

        for (const declaration of hasInitializers) {
            handleTypeAssertion(declaration);
        }
    };

    const handleExportFunctionOrClass = (node: ts.ClassDeclaration | ts.FunctionDeclaration) => {
        const exportModifier = findExportKeyword(node);
        if (!exportModifier) {
            return;
        }

        removeExport(exportModifier.getStart(), exportModifier.end);
        addGetter(node.name);

        // Can't export default here
        if (node.name) {
            exportedNames.addExport(node.name);
        }
    };

    const handleStore = (ident: ts.Node, parent: ts.Node) => {
        const storename = ident.getText().slice(1); // drop the $
        // handle assign to
        // eslint-disable-next-line max-len
        if (
            parent &&
            ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind == ts.SyntaxKind.EqualsToken &&
            parent.left == ident
        ) {
            //remove $
            const dollar = str.original.indexOf('$', ident.getStart() + astOffset);
            str.remove(dollar, dollar + 1);
            // replace = with .set(
            str.overwrite(ident.end + astOffset, parent.operatorToken.end + astOffset, '.set(');
            // append )
            str.appendLeft(parent.end + astOffset, ')');
            return;
        }
        // ignore break
        if (parent && parent.kind === ts.SyntaxKind.BreakStatement) {
            return;
        }
        // handle Assignment operators ($store +=, -=, *=, /=, %=, **=, etc.)
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators#Assignment
        const operators = {
            [ts.SyntaxKind.PlusEqualsToken]: '+',
            [ts.SyntaxKind.MinusEqualsToken]: '-',
            [ts.SyntaxKind.AsteriskEqualsToken]: '*',
            [ts.SyntaxKind.SlashEqualsToken]: '/',
            [ts.SyntaxKind.PercentEqualsToken]: '%',
            [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: '**',
            [ts.SyntaxKind.LessThanLessThanEqualsToken]: '<<',
            [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: '>>',
            [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: '>>>',
            [ts.SyntaxKind.AmpersandEqualsToken]: '&',
            [ts.SyntaxKind.CaretEqualsToken]: '^',
            [ts.SyntaxKind.BarEqualsToken]: '|'
        };
        if (
            ts.isBinaryExpression(parent) &&
            parent.left == ident &&
            Object.keys(operators).find((x) => x === String(parent.operatorToken.kind))
        ) {
            const operator = operators[parent.operatorToken.kind];
            str.overwrite(
                parent.getStart() + astOffset,
                str.original.indexOf('=', ident.end + astOffset) + 1,
                `${storename}.set( $${storename} ${operator}`
            );
            str.appendLeft(parent.end + astOffset, ')');
            return;
        }
        // handle $store++, $store--, ++$store, --$store
        if (
            (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
            parent.operator !==
                ts.SyntaxKind.ExclamationToken /* `!$store` does not need processing */
        ) {
            let simpleOperator: string;
            if (parent.operator === ts.SyntaxKind.PlusPlusToken) {
                simpleOperator = '+';
            }
            if (parent.operator === ts.SyntaxKind.MinusMinusToken) {
                simpleOperator = '-';
            }

            if (simpleOperator) {
                str.overwrite(
                    parent.getStart() + astOffset,
                    parent.end + astOffset,
                    `${storename}.set( $${storename} ${simpleOperator} 1)`
                );
                return;
            } else {
                console.warn(
                    `Warning - unrecognized UnaryExpression operator ${parent.operator}!
                This is an edge case unaccounted for in svelte2tsx, please file an issue:
                https://github.com/sveltejs/language-tools/issues/new/choose
                `,
                    parent.getText()
                );
            }
        }

        // we change "$store" references into "(__sveltets_store_get(store), $store)"
        // - in order to get ts errors if store is not assignable to SvelteStore
        // - use $store variable defined above to get ts flow control
        const dollar = str.original.indexOf('$', ident.getStart() + astOffset);
        str.overwrite(dollar, dollar + 1, '(__sveltets_store_get(');
        str.prependLeft(ident.end + astOffset, `), $${storename})`);
    };

    const resolveStore = (pending: PendingStoreResolution<ts.Node>) => {
        let { node, parent, scope } = pending;
        const name = (node as ts.Identifier).text;
        while (scope) {
            if (scope.declared.has(name)) {
                //we were manually declared, this isn't a store access.
                return;
            }
            scope = scope.parent;
        }
        //We haven't been resolved, we must be a store read/write, handle it.
        handleStore(node, parent);
        const storename = node.getText().slice(1);
        implicitStoreValues.addStoreAcess(storename);
    };

    const handleIdentifier = (ident: ts.Identifier, parent: ts.Node) => {
        if (ident.text === '$$props') {
            uses$$props = true;
            return;
        }
        if (ident.text === '$$restProps') {
            uses$$restProps = true;
            return;
        }
        if (ident.text === '$$slots') {
            uses$$slots = true;
            return;
        }

        if (ts.isLabeledStatement(parent) && parent.label == ident) {
            return;
        }

        if (isDeclaration || ts.isParameter(parent)) {
            if (
                isNotPropertyNameOfImport(ident) &&
                (!ts.isBindingElement(ident.parent) || ident.parent.name == ident)
            ) {
                // we are a key, not a name, so don't care
                if (ident.text.startsWith('$') || scope == rootScope) {
                    // track all top level declared identifiers and all $ prefixed identifiers
                    scope.declared.add(ident.text);
                }
            }
        } else {
            //track potential store usage to be resolved
            if (ident.text.startsWith('$')) {
                if (
                    (!ts.isPropertyAccessExpression(parent) || parent.expression == ident) &&
                    (!ts.isPropertyAssignment(parent) || parent.initializer == ident)
                ) {
                    pendingStoreResolutions.push({ node: ident, parent, scope });
                }
            }
        }
    };

    const handleExportedVariableDeclarationList = (list: ts.VariableDeclarationList) => {
        ts.forEachChild(list, (node) => {
            if (ts.isVariableDeclaration(node)) {
                if (ts.isIdentifier(node.name)) {
                    exportedNames.addExport(node.name, node.name, node.type, !node.initializer);
                } else if (
                    ts.isObjectBindingPattern(node.name) ||
                    ts.isArrayBindingPattern(node.name)
                ) {
                    ts.forEachChild(node.name, (element) => {
                        if (ts.isBindingElement(element)) {
                            exportedNames.addExport(element.name);
                        }
                    });
                }
            }
        });
    };

    const wrapExpressionWithInvalidate = (expression: ts.Expression | undefined) => {
        if (!expression) {
            return;
        }

        const start = expression.getStart() + astOffset;
        const end = expression.getEnd() + astOffset;

        // () => ({})
        if (ts.isObjectLiteralExpression(expression)) {
            str.appendLeft(start, '(');
            str.appendRight(end, ')');
        }

        str.prependLeft(start, '__sveltets_invalidate(() => ');
        str.appendRight(end, ')');
        // Not adding ';' at the end because right now this function is only invoked
        // in situations where there is a line break of ; guaranteed to be present (else the code is invalid)
    };

    const walk = (node: ts.Node, parent: ts.Node) => {
        type onLeaveCallback = () => void;
        const onLeaveCallbacks: onLeaveCallback[] = [];

        if (ts.isInterfaceDeclaration(node) && node.name.text === 'ComponentEvents') {
            events.setComponentEventsInterface(node);
        }

        if (ts.isVariableStatement(node)) {
            const exportModifier = findExportKeyword(node);
            if (exportModifier) {
                const isLet = node.declarationList.flags === ts.NodeFlags.Let;
                const isConst = node.declarationList.flags === ts.NodeFlags.Const;

                handleExportedVariableDeclarationList(node.declarationList);
                if (isLet) {
                    propTypeAssertToUserDefined(node.declarationList);
                } else if (isConst) {
                    node.declarationList.forEachChild((n) => {
                        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
                            addGetter(n.name);
                        }
                    });
                }
                removeExport(exportModifier.getStart(), exportModifier.end);
            }
        }

        if (ts.isFunctionDeclaration(node)) {
            handleExportFunctionOrClass(node);

            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isClassDeclaration(node)) {
            handleExportFunctionOrClass(node);
        }

        if (ts.isBlock(node)) {
            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isArrowFunction(node)) {
            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isExportDeclaration(node)) {
            const { exportClause } = node;
            if (ts.isNamedExports(exportClause)) {
                for (const ne of exportClause.elements) {
                    if (ne.propertyName) {
                        exportedNames.addExport(ne.propertyName, ne.name);
                    } else {
                        exportedNames.addExport(ne.name);
                    }
                }
                //we can remove entire statement
                removeExport(node.getStart(), node.end);
            }
        }

        if (ts.isImportDeclaration(node)) {
            //move imports to top of script so they appear outside our render function
            str.move(node.getStart() + astOffset, node.end + astOffset, script.start + 1);
            //add in a \n
            const originalEndChar = str.original[node.end + astOffset - 1];
            str.overwrite(node.end + astOffset - 1, node.end + astOffset, originalEndChar + '\n');
            // Check if import is the event dispatcher
            events.checkIfImportIsEventDispatcher(node);
        }

        if (ts.isVariableDeclaration(node)) {
            events.checkIfIsStringLiteralDeclaration(node);
            events.checkIfDeclarationInstantiatedEventDispatcher(node);
            implicitStoreValues.addVariableDeclaration(node);
        }

        if (ts.isCallExpression(node)) {
            events.checkIfCallExpressionIsDispatch(node);
        }

        if (ts.isVariableDeclaration(parent) && parent.name == node) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => (isDeclaration = false));
        }

        if (ts.isBindingElement(parent) && parent.name == node) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => (isDeclaration = false));
        }

        if (ts.isImportClause(node)) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => (isDeclaration = false));
            implicitStoreValues.addImportStatement(node);
        }

        if (ts.isImportSpecifier(node)) {
            implicitStoreValues.addImportStatement(node);
        }

        //handle stores etc
        if (ts.isIdentifier(node)) {
            handleIdentifier(node, parent);
        }

        //track implicit declarations in reactive blocks at the top level
        if (
            ts.isLabeledStatement(node) &&
            parent == tsAst && //top level
            node.label.text == '$' &&
            node.statement
        ) {
            const binaryExpression = getBinaryAssignmentExpr(node);
            if (binaryExpression) {
                implicitTopLevelNames.add(node);
                implicitStoreValues.addReactiveDeclaration(node);
                wrapExpressionWithInvalidate(binaryExpression.right);
            } else {
                const start = node.getStart() + astOffset;
                const end = node.getEnd() + astOffset;

                str.prependLeft(start, ';() => {');
                str.appendRight(end, '}');
            }
        }

        // Defensively call function (checking for undefined) because it got added only recently (TS 4.0)
        // and therefore might break people using older TS versions
        if (ts.isTypeAssertionExpression?.(node)) {
            handleTypeAssertion(str, node, astOffset);
        }

        //to save a bunch of condition checks on each node, we recurse into processChild which skips all the checks for top level items
        ts.forEachChild(node, (n) => walk(n, node));
        //fire off the on leave callbacks
        onLeaveCallbacks.map((c) => c());
    };

    //walk the ast and convert to tsx as we go
    tsAst.forEachChild((n) => walk(n, tsAst));

    //resolve stores
    pendingStoreResolutions.map(resolveStore);

    // declare implicit reactive variables we found in the script
    implicitTopLevelNames.modifyCode(rootScope.declared, astOffset, str);
    implicitStoreValues.modifyCode(astOffset, str);

    const firstImport = tsAst.statements
        .filter(ts.isImportDeclaration)
        .sort((a, b) => a.end - b.end)[0];
    if (firstImport) {
        str.appendRight(firstImport.getStart() + astOffset, '\n');
    }

    return {
        exportedNames,
        events,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        getters
    };
}
