import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import * as ts from 'typescript';
import {
    getBinaryAssignmentExpr,
    isSafeToPrefixWithSemicolon,
    isNotPropertyNameOfImport
} from './utils/tsAst';
import { ExportedNames, is$$PropsDeclaration } from './nodes/ExportedNames';
import { ImplicitTopLevelNames } from './nodes/ImplicitTopLevelNames';
import { ComponentEvents, is$$EventsDeclaration } from './nodes/ComponentEvents';
import { Scope } from './utils/Scope';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { Generics } from './nodes/Generics';
import { is$$SlotsDeclaration } from './nodes/slot';
import { preprendStr } from '../utils/magic-string';

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    events: ComponentEvents;
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    uses$$SlotsInterface: boolean;
    generics: Generics;
}

interface PendingStoreResolution {
    node: ts.Identifier;
    parent: ts.Node;
    scope: Scope;
}

export function processInstanceScriptContent(
    str: MagicString,
    script: Node,
    events: ComponentEvents,
    implicitStoreValues: ImplicitStoreValues,
    mode: 'tsx' | 'dts'
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
    const exportedNames = new ExportedNames(str, astOffset);
    const generics = new Generics(str, astOffset);

    const implicitTopLevelNames = new ImplicitTopLevelNames(str, astOffset);
    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;
    let uses$$SlotsInterface = false;

    //track if we are in a declaration scope
    let isDeclaration = false;

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $
    const pendingStoreResolutions: PendingStoreResolution[] = [];

    let scope = new Scope();
    const rootScope = scope;

    const pushScope = () => (scope = new Scope(scope));
    const popScope = () => (scope = scope.parent);

    const handleStore = (ident: ts.Identifier, parent: ts.Node) => {
        // ignore "typeof $store"
        if (parent && parent.kind === ts.SyntaxKind.TypeQuery) {
            return;
        }
        // ignore break
        if (parent && parent.kind === ts.SyntaxKind.BreakStatement) {
            return;
        }

        const storename = ident.getText().slice(1); // drop the $
        // handle assign to
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

        // we change "$store" references into "(__sveltets_1_store_get(store), $store)"
        // - in order to get ts errors if store is not assignable to SvelteStore
        // - use $store variable defined above to get ts flow control
        const dollar = str.original.indexOf('$', ident.getStart() + astOffset);
        const getPrefix = isSafeToPrefixWithSemicolon(ident) ? ';' : '';
        str.overwrite(dollar, dollar + 1, getPrefix + '(__sveltets_1_store_get(');
        str.prependLeft(ident.end + astOffset, `), $${storename})`);
    };

    const resolveStore = (pending: PendingStoreResolution) => {
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
                    (!ts.isPropertyAssignment(parent) || parent.initializer == ident) &&
                    !ts.isPropertySignature(parent) &&
                    !ts.isPropertyDeclaration(parent) &&
                    !ts.isTypeReferenceNode(parent) &&
                    !ts.isTypeAliasDeclaration(parent) &&
                    !ts.isInterfaceDeclaration(parent)
                ) {
                    pendingStoreResolutions.push({ node: ident, parent, scope });
                }
            }
        }
    };

    const walk = (node: ts.Node, parent: ts.Node) => {
        type onLeaveCallback = () => void;
        const onLeaveCallbacks: onLeaveCallback[] = [];

        generics.addIfIsGeneric(node);

        if (is$$EventsDeclaration(node)) {
            events.setComponentEventsInterface(node, astOffset);
        }
        if (is$$SlotsDeclaration(node)) {
            uses$$SlotsInterface = true;
        }
        if (is$$PropsDeclaration(node)) {
            exportedNames.setUses$$Props();
        }

        if (ts.isVariableStatement(node)) {
            exportedNames.handleVariableStatement(node, parent);
        }

        if (ts.isFunctionDeclaration(node)) {
            exportedNames.handleExportFunctionOrClass(node);

            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isClassDeclaration(node)) {
            exportedNames.handleExportFunctionOrClass(node);
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
            exportedNames.handleExportDeclaration(node);
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

        // workaround for import statement completion
        if (ts.isImportEqualsDeclaration(node)) {
            const end = node.getEnd() + astOffset;

            if (str.original[end - 1] !== ';') {
                preprendStr(str, end, ';');
            }
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
            }
            implicitTopLevelNames.handleReactiveStatement(node, binaryExpression);
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
    implicitTopLevelNames.modifyCode(rootScope.declared);
    implicitStoreValues.modifyCode(astOffset, str);

    const firstImport = tsAst.statements
        .filter(ts.isImportDeclaration)
        .sort((a, b) => a.end - b.end)[0];
    if (firstImport) {
        str.appendRight(firstImport.getStart() + astOffset, '\n');
    }

    if (mode === 'dts') {
        // Transform interface declarations to type declarations because indirectly
        // using interfaces inside the return type of a function is forbidden.
        // This is not a problem for intellisense/type inference but it will
        // break dts generation (file will not be generated).
        transformInterfacesToTypes(tsAst, str, astOffset);
    }

    return {
        exportedNames,
        events,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        uses$$SlotsInterface,
        generics
    };
}

function transformInterfacesToTypes(tsAst: ts.SourceFile, str: MagicString, astOffset: any) {
    tsAst.statements.filter(ts.isInterfaceDeclaration).forEach((node) => {
        str.overwrite(
            node.getStart() + astOffset,
            node.getStart() + astOffset + 'interface'.length,
            'type'
        );

        if (node.heritageClauses?.length) {
            const extendsStart = node.heritageClauses[0].getStart() + astOffset;
            str.overwrite(extendsStart, extendsStart + 'extends'.length, '=');

            const extendsList = node.heritageClauses[0].types;
            let prev = extendsList[0];
            extendsList.slice(1).forEach((heritageClause) => {
                str.overwrite(
                    prev.getEnd() + astOffset,
                    heritageClause.getStart() + astOffset,
                    ' & '
                );
                prev = heritageClause;
            });

            str.appendLeft(node.heritageClauses[0].getEnd() + astOffset, ' & ');
        } else {
            str.prependLeft(str.original.indexOf('{', node.getStart() + astOffset), '=');
        }
    });
}
