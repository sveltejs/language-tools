import dedent from 'dedent-js';
import { pascalCase } from 'pascal-case';
import MagicString from 'magic-string';
import path from 'path';
import { parseHtmlx } from './htmlxparser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'estree-walker';
import * as ts from 'typescript';
import { EventHandler } from './nodes/event-handler';
import { findExortKeyword, getBinaryAssignmentExpr } from './utils/tsAst';
import {
    InstanceScriptProcessResult,
    CreateRenderFunctionPara,
    AddComponentExportPara,
} from './interfaces';
import { createRenderFunctionGetterStr, createClassGetters } from './nodes/exportgetters';
import { ExportedNames } from './nodes/ExportedNames';
import { ImplicitTopLevelNames } from './nodes/ImplicitTopLevelNames';
import {
    ComponentEvents,
    ComponentEventsFromInterface,
    ComponentEventsFromEventsMap,
} from './nodes/ComponentEvents';

function AttributeValueAsJsExpression(htmlx: string, attr: Node): string {
    if (attr.value.length == 0) return "''"; //wut?

    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        if (attrVal.type == 'AttributeShorthand') {
            return attrVal.expression.name;
        }

        if (attrVal.type == 'Text') {
            return '"' + attrVal.raw + '"';
        }

        if (attrVal.type == 'MustacheTag') {
            return htmlx.substring(attrVal.expression.start, attrVal.expression.end);
        }
        throw Error('Unknown attribute value type:' + attrVal.type);
    }

    // we have multiple attribute values, so we know we are building a string out of them.
    // so return a dummy string, it will typecheck the same :)
    return '"__svelte_ts_string"';
}

type TemplateProcessResult = {
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    slots: Map<string, Map<string, string>>;
    scriptTag: Node;
    moduleScriptTag: Node;
    /** To be added later as a comment on the default class export */
    componentDocumentation: string | null;
    events: ComponentEvents;
};

class Scope {
    declared: Set<string> = new Set();
    parent: Scope;

    constructor(parent?: Scope) {
        this.parent = parent;
    }
}

type pendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
};

/**
 * Add this tag to a HTML comment in a Svelte component and its contents will
 * be added as a docstring in the resulting JSX for the component class.
 */
const COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG = '@component';

/**
 * A component class name suffix is necessary to prevent class name clashes
 * like reported in https://github.com/sveltejs/language-tools/issues/294
 */
const COMPONENT_SUFFIX = '__SvelteComponent_';

function processSvelteTemplate(str: MagicString): TemplateProcessResult {
    const htmlxAst = parseHtmlx(str.original);

    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;

    let componentDocumentation = null;

    //track if we are in a declaration scope
    let isDeclaration = false;

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const pendingStoreResolutions: pendingStoreResolution<Node>[] = [];
    let scope = new Scope();
    const pushScope = () => (scope = new Scope(scope));
    const popScope = () => (scope = scope.parent);

    const handleStore = (node: Node, parent: Node) => {
        //handle assign to
        if (
            parent.type == 'AssignmentExpression' &&
            parent.left == node &&
            parent.operator == '='
        ) {
            const dollar = str.original.indexOf('$', node.start);
            str.remove(dollar, dollar + 1);
            str.overwrite(node.end, str.original.indexOf('=', node.end) + 1, '.set(');
            str.appendLeft(parent.end, ')');
            return;
        }
        // handle Assignment operators ($store +=, -=, *=, /=, %=, **=, etc.)
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators#Assignment
        const operators = [
            '+=',
            '-=',
            '*=',
            '/=',
            '%=',
            '**=',
            '<<=',
            '>>=',
            '>>>=',
            '&=',
            '^=',
            '|=',
        ];
        if (
            parent.type == 'AssignmentExpression' &&
            parent.left == node &&
            operators.includes(parent.operator)
        ) {
            const storename = node.name.slice(1); // drop the $
            const operator = parent.operator.substring(0, parent.operator.length - 1); // drop the = sign
            str.overwrite(
                parent.start,
                str.original.indexOf('=', node.end) + 1,
                `${storename}.set( __sveltets_store_get(${storename}) ${operator}`,
            );
            str.appendLeft(parent.end, ')');
            return;
        }
        // handle $store++, $store--, ++$store, --$store
        if (parent.type == 'UpdateExpression') {
            let simpleOperator;
            if (parent.operator === '++') simpleOperator = '+';
            if (parent.operator === '--') simpleOperator = '-';
            if (simpleOperator) {
                const storename = node.name.slice(1); // drop the $
                str.overwrite(
                    parent.start,
                    parent.end,
                    `${storename}.set( __sveltets_store_get(${storename}) ${simpleOperator} 1)`,
                );
            } else {
                console.warn(
                    `Warning - unrecognized UpdateExpression operator ${parent.operator}!
                This is an edge case unaccounted for in svelte2tsx, please file an issue:
                https://github.com/sveltejs/language-tools/issues/new/choose
                `,
                    str.original.slice(parent.start, parent.end),
                );
            }
            return;
        }

        //rewrite get
        const dollar = str.original.indexOf('$', node.start);
        str.overwrite(dollar, dollar + 1, '__sveltets_store_get(');
        str.prependLeft(node.end, ')');
    };

    const resolveStore = (pending: pendingStoreResolution<Node>) => {
        let { node, parent, scope } = pending;
        const name = node.name;
        while (scope) {
            if (scope.declared.has(name)) {
                //we were manually declared, this isn't a store access.
                return;
            }
            scope = scope.parent;
        }
        //We haven't been resolved, we must be a store read/write, handle it.
        handleStore(node, parent);
    };

    const enterBlockStatement = () => pushScope();
    const leaveBlockStatement = () => popScope();

    const enterFunctionDeclaration = () => pushScope();
    const leaveFunctionDeclaration = () => popScope();

    const enterArrowFunctionExpression = () => pushScope();
    const leaveArrowFunctionExpression = () => popScope();

    const handleComment = (node: Node) => {
        if (
            'data' in node &&
            typeof node.data === 'string' &&
            node.data.includes(COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG)
        ) {
            componentDocumentation = node.data
                .replace(COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG, '')
                .trim();
        }
    };

    const handleIdentifier = (node: Node, parent: Node, prop: string) => {
        if (node.name === '$$props') {
            uses$$props = true;
            return;
        }
        if (node.name === '$$restProps') {
            uses$$restProps = true;
            return;
        }

        if (node.name === '$$slots') {
            uses$$slots = true;
            return;
        }

        //handle potential store
        if (node.name[0] == '$') {
            if (isDeclaration) {
                if (parent.type == 'Property' && prop == 'key') return;
                scope.declared.add(node.name);
            } else {
                if (parent.type == 'MemberExpression' && prop == 'property' && !parent.computed)
                    return;
                if (parent.type == 'Property' && prop == 'key') return;
                pendingStoreResolutions.push({ node, parent, scope });
            }
            return;
        }
    };

    // All script tags, no matter at what level, are listed within the root children.
    // To get the top level scripts, filter out all those that are part of children's children.
    // Those have another type ('Element' with name 'script').
    const scriptTags = (<Node[]>htmlxAst.children).filter((child) => child.type === 'Script');
    let topLevelScripts = scriptTags;
    const handleScriptTag = (node: Node, parent: Node) => {
        if (parent !== htmlxAst && node.name === 'script') {
            topLevelScripts = topLevelScripts.filter(
                (tag) => tag.start !== node.start || tag.end !== node.end,
            );
        }
    };
    const getTopLevelScriptTags = () => {
        let scriptTag: Node = null;
        let moduleScriptTag: Node = null;
        // should be 2 at most, one each, so using forEach is safe
        topLevelScripts.forEach((tag) => {
            if (
                tag.attributes &&
                tag.attributes.find(
                    (a) => a.name == 'context' && a.value.length == 1 && a.value[0].raw == 'module',
                )
            ) {
                moduleScriptTag = tag;
            } else {
                scriptTag = tag;
            }
        });
        return { scriptTag, moduleScriptTag };
    };
    const blankOtherScriptTags = () => {
        scriptTags
            .filter((tag) => !topLevelScripts.includes(tag))
            .forEach((tag) => {
                str.remove(tag.start, tag.end);
            });
    };

    const slots = new Map<string, Map<string, string>>();
    const handleSlot = (node: Node) => {
        const nameAttr = node.attributes.find((a) => a.name == 'name');
        const slotName = nameAttr ? nameAttr.value[0].raw : 'default';
        //collect attributes
        const attributes = new Map<string, string>();
        for (const attr of node.attributes) {
            if (attr.name == 'name') continue;
            if (!attr.value.length) continue;
            attributes.set(attr.name, AttributeValueAsJsExpression(str.original, attr));
        }
        slots.set(slotName, attributes);
    };

    const handleStyleTag = (node: Node) => {
        str.remove(node.start, node.end);
    };

    const eventHandler = new EventHandler();

    const onHtmlxWalk = (node: Node, parent: Node, prop: string) => {
        if (
            prop == 'params' &&
            (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
        ) {
            isDeclaration = true;
        }
        if (prop == 'id' && parent.type == 'VariableDeclarator') {
            isDeclaration = true;
        }

        switch (node.type) {
            case 'Comment':
                handleComment(node);
                break;
            case 'Identifier':
                handleIdentifier(node, parent, prop);
                break;
            case 'Slot':
                handleSlot(node);
                break;
            case 'Style':
                handleStyleTag(node);
                break;
            case 'Element':
                handleScriptTag(node, parent);
                break;
            case 'BlockStatement':
                enterBlockStatement();
                break;
            case 'FunctionDeclaration':
                enterFunctionDeclaration();
                break;
            case 'ArrowFunctionExpression':
                enterArrowFunctionExpression();
                break;
            case 'EventHandler':
                eventHandler.handleEventHandler(node, parent);
                break;
            case 'VariableDeclarator':
                isDeclaration = true;
                break;
        }
    };

    const onHtmlxLeave = (node: Node, parent: Node, prop: string, _index: number) => {
        if (
            prop == 'params' &&
            (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
        ) {
            isDeclaration = false;
        }

        if (prop == 'id' && parent.type == 'VariableDeclarator') {
            isDeclaration = false;
        }

        switch (node.type) {
            case 'BlockStatement':
                leaveBlockStatement();
                break;
            case 'FunctionDeclaration':
                leaveFunctionDeclaration();
                break;
            case 'ArrowFunctionExpression':
                leaveArrowFunctionExpression();
                break;
        }
    };

    convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk, onHtmlxLeave);

    // resolve scripts
    const { scriptTag, moduleScriptTag } = getTopLevelScriptTags();
    blankOtherScriptTags();

    //resolve stores
    pendingStoreResolutions.map(resolveStore);

    return {
        moduleScriptTag,
        scriptTag,
        slots,
        events: new ComponentEventsFromEventsMap(eventHandler),
        uses$$props,
        uses$$restProps,
        uses$$slots,
        componentDocumentation,
    };
}

function processInstanceScriptContent(
    str: MagicString,
    script: Node,
    events: ComponentEvents,
): InstanceScriptProcessResult {
    const htmlx = str.original;
    const scriptContent = htmlx.substring(script.content.start, script.content.end);
    const tsAst = ts.createSourceFile(
        'component.ts.svelte',
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
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
    const pendingStoreResolutions: pendingStoreResolution<ts.Node>[] = [];

    let scope = new Scope();
    const rootScope = scope;

    const pushScope = () => (scope = new Scope(scope));
    const popScope = () => (scope = scope.parent);

    const addExport = (
        name: ts.BindingName,
        target: ts.BindingName = null,
        type: ts.TypeNode = null,
        required = false,
    ) => {
        if (name.kind != ts.SyntaxKind.Identifier) {
            throw Error('export source kind not supported ' + name);
        }
        if (target && target.kind != ts.SyntaxKind.Identifier) {
            throw Error('export target kind not supported ' + target);
        }
        if (target) {
            exportedNames.set(name.text, {
                type: type?.getText(),
                identifierText: (target as ts.Identifier).text,
                required,
            });
        } else {
            exportedNames.set(name.text, {});
        }
    };
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

            if (!ts.isIdentifier(identifier) || !type) {
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

    const handleStore = (ident: ts.Node, parent: ts.Node) => {
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
            [ts.SyntaxKind.BarEqualsToken]: '|',
        };
        if (
            ts.isBinaryExpression(parent) &&
            parent.left == ident &&
            Object.keys(operators).find((x) => x === String(parent.operatorToken.kind))
        ) {
            const storename = ident.getText().slice(1); // drop the $
            const operator = operators[parent.operatorToken.kind];
            str.overwrite(
                parent.getStart() + astOffset,
                str.original.indexOf('=', ident.end + astOffset) + 1,
                `${storename}.set( __sveltets_store_get(${storename}) ${operator}`,
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
                const storename = ident.getText().slice(1); // drop the $
                str.overwrite(
                    parent.getStart() + astOffset,
                    parent.end + astOffset,
                    `${storename}.set( __sveltets_store_get(${storename}) ${simpleOperator} 1)`,
                );
                return;
            } else {
                console.warn(
                    `Warning - unrecognized UnaryExpression operator ${parent.operator}!
                This is an edge case unaccounted for in svelte2tsx, please file an issue:
                https://github.com/sveltejs/language-tools/issues/new/choose
                `,
                    parent.getText(),
                );
            }
        }

        // we must be on the right or not part of assignment
        const dollar = str.original.indexOf('$', ident.getStart() + astOffset);
        str.overwrite(dollar, dollar + 1, '__sveltets_store_get(');
        str.appendLeft(ident.end + astOffset, ')');
    };

    const resolveStore = (pending: pendingStoreResolution<ts.Node>) => {
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
            if (!ts.isBindingElement(ident.parent) || ident.parent.name == ident) {
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
                    addExport(node.name, node.name, node.type, !node.initializer);
                } else if (
                    ts.isObjectBindingPattern(node.name) ||
                    ts.isArrayBindingPattern(node.name)
                ) {
                    ts.forEachChild(node.name, (element) => {
                        if (ts.isBindingElement(element)) {
                            addExport(element.name);
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
            events = new ComponentEventsFromInterface(node);
        }

        if (ts.isVariableStatement(node)) {
            const exportModifier = findExortKeyword(node);
            if (exportModifier) {
                const isLet = node.declarationList.flags === ts.NodeFlags.Let;
                const isConst = node.declarationList.flags === ts.NodeFlags.Const;

                if (isLet) {
                    handleExportedVariableDeclarationList(node.declarationList);
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
            if (node.modifiers) {
                const exportModifier = findExortKeyword(node);
                if (exportModifier) {
                    removeExport(exportModifier.getStart(), exportModifier.end);
                    addGetter(node.name);
                }
            }

            pushScope();
            onLeaveCallbacks.push(() => popScope());
        }

        if (ts.isClassDeclaration(node)) {
            const exportModifier = findExortKeyword(node);
            if (exportModifier) {
                removeExport(exportModifier.getStart(), exportModifier.end);
                addGetter(node.name);
            }
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
                        addExport(ne.propertyName, ne.name);
                    } else {
                        addExport(ne.name);
                    }
                }
                //we can remove entire statement
                removeExport(node.getStart(), node.end);
            }
        }

        //move imports to top of script so they appear outside our render function
        if (ts.isImportDeclaration(node)) {
            str.move(node.getStart() + astOffset, node.end + astOffset, script.start + 1);
            //add in a \n
            const originalEndChar = str.original[node.end + astOffset - 1];
            str.overwrite(node.end + astOffset - 1, node.end + astOffset, originalEndChar + '\n');
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
                wrapExpressionWithInvalidate(binaryExpression.right);
            } else {
                const start = node.getStart() + astOffset;
                const end = node.getEnd() + astOffset;

                str.prependLeft(start, ';() => {');
                str.prependRight(end, '}');
            }
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
        getters,
    };
}

function formatComponentDocumentation(contents?: string | null) {
    if (!contents) return '';
    if (!contents.includes('\n')) {
        return `/** ${contents} */\n`;
    }

    const lines = dedent(contents)
        .split('\n')
        .map((line) => ` *${line ? ` ${line}` : ''}`)
        .join('\n');

    return `/**\n${lines}\n */\n`;
}

function addComponentExport({
    str,
    uses$$propsOr$$restProps,
    strictMode,
    strictEvents,
    isTsFile,
    getters,
    className,
    componentDocumentation,
}: AddComponentExportPara) {
    const eventsDef = strictEvents ? 'render' : '__sveltets_with_any_event(render)';
    const propDef =
        // Omit partial-wrapper only if both strict mode and ts file, because
        // in a js file the user has no way of telling the language that
        // the prop is optional
        strictMode && isTsFile
            ? uses$$propsOr$$restProps
                ? `__sveltets_with_any(${eventsDef})`
                : eventsDef
            : `__sveltets_partial${uses$$propsOr$$restProps ? '_with_any' : ''}(${eventsDef})`;

    const doc = formatComponentDocumentation(componentDocumentation);

    const statement =
        `\n\n${doc}export default class${
            className ? ` ${className}` : ''
        } extends createSvelte2TsxComponent(${propDef}) {` +
        createClassGetters(getters) +
        '\n}';

    str.append(statement);
}

/**
 * Returns a Svelte-compatible component name from a filename. Svelte
 * components must use capitalized tags, so we try to transform the filename.
 *
 * https://svelte.dev/docs#Tags
 */
export function classNameFromFilename(filename: string): string | undefined {
    try {
        const withoutExtensions = path.parse(filename).name?.split('.')[0];
        const inPascalCase = pascalCase(withoutExtensions);
        return `${inPascalCase}${COMPONENT_SUFFIX}`;
    } catch (error) {
        console.warn(`Failed to create a name for the component class from filename ${filename}`);
        return undefined;
    }
}

function processModuleScriptTag(str: MagicString, script: Node) {
    const htmlx = str.original;

    const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
    const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

    str.overwrite(script.start, scriptStartTagEnd, '</>;');
    str.overwrite(scriptEndTagStart, script.end, ';<>');
}

function createRenderFunction({
    str,
    scriptTag,
    scriptDestination,
    slots,
    getters,
    events,
    exportedNames,
    isTsFile,
    uses$$props,
    uses$$restProps,
    uses$$slots,
}: CreateRenderFunctionPara) {
    const htmlx = str.original;
    let propsDecl = '';

    if (uses$$props) {
        propsDecl += ' let $$props = __sveltets_allPropsType();';
    }
    if (uses$$restProps) {
        propsDecl += ' let $$restProps = __sveltets_restPropsType();';
    }

    if (uses$$slots) {
        propsDecl +=
            'let $$slots: { ' +
            Array.from(slots.keys())
                .map((name) => `${name}: any`)
                .join(', ') +
            ' = __sveltets_slotsType();';
    }

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        const scriptTagEnd = htmlx.lastIndexOf('>', scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start + 1, '</>;');
        str.overwrite(scriptTag.start + 1, scriptTagEnd, `function render() {${propsDecl}\n`);

        const scriptEndTagStart = htmlx.lastIndexOf('<', scriptTag.end - 1);
        // wrap template with callback
        str.overwrite(scriptEndTagStart, scriptTag.end, ';\n() => (<>', {
            contentOnly: true,
        });
    } else {
        str.prependRight(scriptDestination, `</>;function render() {${propsDecl}\n<>`);
    }

    const slotsAsDef =
        '{' +
        Array.from(slots.entries())
            .map(([name, attrs]) => {
                const attrsAsString = Array.from(attrs.entries())
                    .map(([exportName, expr]) => `${exportName}:${expr}`)
                    .join(', ');
                return `${name}: {${attrsAsString}}`;
            })
            .join(', ') +
        '}';

    const returnString =
        `\nreturn { props: ${exportedNames.createPropsStr(
            isTsFile,
        )}, slots: ${slotsAsDef}, getters: ${createRenderFunctionGetterStr(getters)}` +
        `, events: ${events.toDefString()} }}`;

    // wrap template with callback
    if (scriptTag) {
        str.append(');');
    }

    str.append(returnString);
}

export function svelte2tsx(
    svelte: string,
    options?: { filename?: string; strictMode?: boolean; isTsFile?: boolean },
) {
    const str = new MagicString(svelte);
    // process the htmlx as a svelte template
    let {
        moduleScriptTag,
        scriptTag,
        slots,
        uses$$props,
        uses$$slots,
        uses$$restProps,
        events,
        componentDocumentation,
    } = processSvelteTemplate(str);

    /* Rearrange the script tags so that module is first, and instance second followed finally by the template
     * This is a bit convoluted due to some trouble I had with magic string. A simple str.move(start,end,0) for each script wasn't enough
     * since if the module script was already at 0, it wouldn't move (which is fine) but would mean the order would be swapped when the script tag tried to move to 0
     * In this case we instead have to move it to moduleScriptTag.end. We track the location for the script move in the MoveInstanceScriptTarget var
     */
    let instanceScriptTarget = 0;

    if (moduleScriptTag) {
        if (moduleScriptTag.start != 0) {
            //move our module tag to the top
            str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        } else {
            //since our module script was already at position 0, we need to move our instance script tag to the end of it.
            instanceScriptTarget = moduleScriptTag.end;
        }
    }

    //move the instance script and process the content
    let exportedNames = new ExportedNames();
    let getters = new Set<string>();
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(str, scriptTag, events);
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, getters } = res);
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        slots,
        events,
        getters,
        exportedNames,
        isTsFile: options?.isTsFile,
        uses$$props,
        uses$$restProps,
        uses$$slots,
    });

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(str, moduleScriptTag);
    }

    const className = options?.filename && classNameFromFilename(options?.filename);

    addComponentExport({
        str,
        uses$$propsOr$$restProps: uses$$props || uses$$restProps,
        strictMode: !!options?.strictMode,
        strictEvents: events instanceof ComponentEventsFromInterface,
        isTsFile: options?.isTsFile,
        getters,
        className,
        componentDocumentation,
    });

    str.prepend('///<reference types="svelte" />\n');

    return {
        code: str.toString(),
        map: str.generateMap({ hires: true, source: options?.filename }),
        exportedNames,
        events,
    };
}
