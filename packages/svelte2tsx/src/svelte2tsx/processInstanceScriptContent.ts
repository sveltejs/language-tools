import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import ts from 'typescript';
import { getBinaryAssignmentExpr, isNotPropertyNameOfImport, moveNode } from './utils/tsAst';
import { ExportedNames, is$$PropsDeclaration } from './nodes/ExportedNames';
import { ImplicitTopLevelNames } from './nodes/ImplicitTopLevelNames';
import { ComponentEvents, is$$EventsDeclaration } from './nodes/ComponentEvents';
import { Scope } from './utils/Scope';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { Generics } from './nodes/Generics';
import { is$$SlotsDeclaration } from './nodes/slot';
import { preprendStr } from '../utils/magic-string';
import {
    handleFirstInstanceImport,
    handleImportDeclaration
} from './nodes/handleImportDeclaration';
import { InterfacesAndTypes } from './nodes/InterfacesAndTypes';

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
    mode: 'ts' | 'dts',
    hasModuleScript: boolean,
    isTSFile: boolean,
    basename: string,
    isSvelte5Plus: boolean,
    isRunes: boolean
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
    const exportedNames = new ExportedNames(
        str,
        astOffset,
        basename,
        isTSFile,
        isSvelte5Plus,
        isRunes
    );
    const generics = new Generics(str, astOffset, script);
    const interfacesAndTypes = new InterfacesAndTypes();

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

    const resolveStore = (pending: PendingStoreResolution) => {
        let { node, scope } = pending;
        const name = (node as ts.Identifier).text;
        while (scope) {
            if (scope.declared.has(name)) {
                //we were manually declared, this isn't a store access.
                return;
            }
            scope = scope.parent;
        }
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
            const text = ident.text;
            //track potential store usage to be resolved
            if (text.startsWith('$')) {
                if (
                    (!ts.isPropertyAccessExpression(parent) || parent.expression == ident) &&
                    (!ts.isPropertyAssignment(parent) || parent.initializer == ident) &&
                    !ts.isPropertySignature(parent) &&
                    !ts.isPropertyDeclaration(parent) &&
                    !ts.isTypeReferenceNode(parent) &&
                    !ts.isTypeAliasDeclaration(parent) &&
                    !ts.isInterfaceDeclaration(parent)
                ) {
                    // Handle the const { ...props } = $props() case
                    const is_rune =
                        (text === '$props' || text === '$derived' || text === '$state') &&
                        ts.isCallExpression(parent) &&
                        ts.isVariableDeclaration(parent.parent) &&
                        parent.parent.name.getText().includes(text.slice(1));
                    if (!is_rune) {
                        pendingStoreResolutions.push({ node: ident, parent, scope });
                    }
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
            exportedNames.uses$$Props = true;
        }

        if (ts.isVariableStatement(node)) {
            exportedNames.handleVariableStatement(node, parent);
        }

        if (ts.isFunctionDeclaration(node)) {
            exportedNames.handleExportFunctionOrClass(node);
        }

        if (ts.isClassDeclaration(node)) {
            exportedNames.handleExportFunctionOrClass(node);
        }

        if (ts.isBlock(node) || ts.isFunctionLike(node)) {
            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isExportDeclaration(node)) {
            exportedNames.handleExportDeclaration(node);
        }

        if (ts.isImportDeclaration(node)) {
            handleImportDeclaration(node, str, astOffset, script.start, tsAst);

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
            // Only top level declarations can be stores
            if (node.parent?.parent?.parent === tsAst) {
                implicitStoreValues.addVariableDeclaration(node);
            }
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

        if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
            interfacesAndTypes.node = node;
            interfacesAndTypes.add(node);
            onLeaveCallbacks.push(() => (interfacesAndTypes.node = null));
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
        // Don't transform in ts mode because <type>value type assertions are valid in this case
        if (mode !== 'ts' && ts.isTypeAssertionExpression?.(node)) {
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

    handleFirstInstanceImport(tsAst, astOffset, hasModuleScript, str);

    // move interfaces and types out of the render function if they are referenced
    // by a $$Generic, otherwise it will be used before being defined after the transformation
    const nodesToMove = interfacesAndTypes.getNodesWithNames(generics.getTypeReferences());
    for (const node of nodesToMove) {
        moveNode(node, str, astOffset, script.start, tsAst);
    }

    if (mode === 'dts') {
        // Transform interface declarations to type declarations because indirectly
        // using interfaces inside the return type of a function is forbidden.
        // This is not a problem for intellisense/type inference but it will
        // break dts generation (file will not be generated).
        transformInterfacesToTypes(tsAst, str, astOffset, nodesToMove);
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

function transformInterfacesToTypes(
    tsAst: ts.SourceFile,
    str: MagicString,
    astOffset: any,
    movedNodes: ts.Node[]
) {
    tsAst.statements
        .filter(ts.isInterfaceDeclaration)
        .filter((i) => !movedNodes.includes(i))
        .forEach((node) => {
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
