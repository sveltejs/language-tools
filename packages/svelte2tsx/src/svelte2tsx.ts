import MagicString from 'magic-string';
import { parseHtmlx } from './htmlxparser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'estree-walker';
import * as ts from 'typescript';

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
    slots: Map<string, Map<string, string>>;
    scriptTag: Node;
    moduleScriptTag: Node;
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

function processSvelteTemplate(str: MagicString): TemplateProcessResult {
    const htmlxAst = parseHtmlx(str.original);

    let uses$$props = false;
    let uses$$restProps = false;

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

    const handleIdentifier = (node: Node, parent: Node, prop: string) => {
        if (node.name === '$$props') {
            uses$$props = true;
            return;
        }
        if (node.name === '$$restProps') {
            uses$$restProps = true;
            return;
        }

        //handle potential store
        if (node.name[0] == '$') {
            if (isDeclaration) {
                if (parent.type == 'Property' && prop == 'key') return;
                scope.declared.add(node.name);
            } else {
                if (parent.type == 'MemberExpression' && prop == 'property') return;
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
        uses$$props,
        uses$$restProps,
    };
}

type ExportedNames = Map<
    string,
    {
        type?: string;
        identifierText?: string;
    }
>;

type InstanceScriptProcessResult = {
    exportedNames: ExportedNames;
    uses$$props: boolean;
    uses$$restProps: boolean;
};

function processInstanceScriptContent(str: MagicString, script: Node): InstanceScriptProcessResult {
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
    const exportedNames = new Map<string, { type?: string; identifierText?: string }>();

    const implicitTopLevelNames: Map<string, number> = new Map();
    let uses$$props = false;
    let uses$$restProps = false;

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
            });
        } else {
            exportedNames.set(name.text, {});
        }
    };

    const removeExport = (start: number, end: number) => {
        const exportStart = str.original.indexOf('export', start + astOffset);
        const exportEnd = exportStart + (end - start);
        str.remove(exportStart, exportEnd);
    };

    const castPropToUserDefined = (node: ts.VariableDeclarationList) => {
        if (node.flags !== ts.NodeFlags.Let) {
            return;
        }

        const hasInitializers = node.declarations.filter(
            (declaration) => declaration.initializer
        );
        const handleCasting = (declaration: ts.VariableDeclaration) => {
            const identifier = declaration.name;
            const tsType = declaration.type;
            const jsDocType = ts.getJSDocType(declaration);
            const type = tsType || jsDocType;

            if (!ts.isIdentifier(identifier) || !type) {
                return;
            }
            const castingTo = type.getFullText().trim();

            const end = declaration.initializer.getEnd() + astOffset;
            if (tsType)  {
                str.appendLeft(end, ` as ${castingTo}`);
            } else {
                const start = declaration.initializer.getStart() + astOffset;
                str.appendRight(start, `/** @type {${castingTo}} */ (`);
                str.appendLeft(end, ')');
            }
        };

        for (const declaration of hasInitializers) {
            handleCasting(declaration);
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
        if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) {
            let simpleOperator;
            if (parent.operator === 45) simpleOperator = '+';
            if (parent.operator === 46) simpleOperator = '-';
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
                    if (node.type) {
                        addExport(node.name, node.name, node.type);
                    } else {
                        addExport(node.name);
                    }
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

    const walk = (node: ts.Node, parent: ts.Node) => {
        type onLeaveCallback = () => void;
        const onLeaveCallbacks: onLeaveCallback[] = [];

        if (ts.isVariableStatement(node)) {
            const exportModifier = node.modifiers
                ? node.modifiers.find((x) => x.kind == ts.SyntaxKind.ExportKeyword)
                : null;
            if (exportModifier) {
                handleExportedVariableDeclarationList(node.declarationList);
                castPropToUserDefined(node.declarationList);
                removeExport(exportModifier.getStart(), exportModifier.end);
            }
        }

        if (ts.isFunctionDeclaration(node)) {
            if (node.modifiers) {
                const exportModifier = node.modifiers.find(
                    (x) => x.kind == ts.SyntaxKind.ExportKeyword,
                );
                if (exportModifier) {
                    addExport(node.name);
                    removeExport(exportModifier.getStart(), exportModifier.end);
                }
            }

            pushScope();
            onLeaveCallbacks.push(() => popScope());
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
        if (ts.isIdentifier(node)) handleIdentifier(node, parent);

        //track implicit declarations in reactive blocks at the top level
        if (
            ts.isLabeledStatement(node) &&
            parent == tsAst && //top level
            node.label.text == '$' &&
            node.statement
        ) {
            if (
                ts.isExpressionStatement(node.statement) &&
                ts.isBinaryExpression(node.statement.expression) &&
                node.statement.expression.operatorToken.kind == ts.SyntaxKind.EqualsToken &&
                ts.isIdentifier(node.statement.expression.left)
            ) {
                implicitTopLevelNames.set(
                    node.statement.expression.left.text, node.label.getStart()
                );
            } else {
                const start = node.getStart() + astOffset;
                const end = node.getEnd() + astOffset;

                str.prependLeft(start, '() => {');
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
    for (const [name, pos] of implicitTopLevelNames.entries()) {
        if (!rootScope.declared.has(name)) {
            //add a declaration
            str.prependRight(pos + astOffset, `;let ${name}; `);
        }
    }

    return {
        exportedNames,
        uses$$props,
        uses$$restProps,
    };
}

function addComponentExport(
    str: MagicString,
    uses$$propsOr$$restProps: boolean,
    strictMode: boolean,
    isTsFile: boolean,
) {
    const propDef =
        // Omit partial-wrapper only if both strict mode and ts file, because
        // in a js file the user has no way of telling the language that
        // the prop is optional
        strictMode && isTsFile
            ? uses$$propsOr$$restProps
                ? '__sveltets_with_any(render().props)'
                : 'render().props'
            : `__sveltets_partial${uses$$propsOr$$restProps ? '_with_any' : ''}(render().props)`;
    str.append(
        // eslint-disable-next-line max-len
        `\n\nexport default class {\n    $$prop_def = ${propDef}\n    $$slot_def = render().slots\n}`,
    );
}

function isTsFile(scriptTag: Node | undefined, moduleScriptTag: Node | undefined) {
    return tagIsLangTs(scriptTag) || tagIsLangTs(moduleScriptTag);

    function tagIsLangTs(tag: Node | undefined) {
        return tag?.attributes?.some((attr) => {
            if (attr.name !== 'lang' && attr.name !== 'type') {
                return false;
            }

            const type = attr.value[0]?.raw;
            switch (type) {
                case 'ts':
                case 'typescript':
                case 'text/ts':
                case 'text/typescript':
                    return true;
                default:
                    return false;
            }
        });
    }
}

function processModuleScriptTag(str: MagicString, script: Node) {
    const htmlx = str.original;

    const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
    const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

    str.overwrite(script.start, scriptStartTagEnd, '</>;');
    str.overwrite(scriptEndTagStart, script.end, ';<>');
}

function createRenderFunction(
    str: MagicString,
    scriptTag: Node,
    scriptDestination: number,
    slots: Map<string, Map<string, string>>,
    exportedNames: ExportedNames,
    uses$$props: boolean,
    uses$$restProps: boolean,
) {
    const htmlx = str.original;
    let propsDecl = '';

    if (uses$$props) {
        propsDecl += ' let $$props = __sveltets_allPropsType();';
    }
    if (uses$$restProps) {
        propsDecl += ' let $$restProps = __sveltets_restPropsType();';
    }

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        const scriptTagEnd = htmlx.lastIndexOf('>', scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start + 1, '</>;');
        str.overwrite(scriptTag.start + 1, scriptTagEnd, `function render() {${propsDecl}\n`);

        const scriptEndTagStart = htmlx.lastIndexOf('<', scriptTag.end - 1);
        str.overwrite(scriptEndTagStart, scriptTag.end, ';\n<>', {
            contentOnly: true
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

    const returnString = `\nreturn { props: ${createPropsStr(
        exportedNames,
    )}, slots: ${slotsAsDef} }}`;
    str.append(returnString);
}

function createPropsStr(exportedNames: ExportedNames) {
    const names = Array.from(exportedNames.entries());

    const returnElements = names.map(([key, value]) => {
        // Important to not use shorthand props for rename functionality
        return `${value.identifierText || key}: ${key}`;
    });

    if (names.length === 0 || !names.some(([_, value]) => !!value.type)) {
        // No exports or only `typeof` exports -> omit the `as {...}` completely
        // -> 2nd case could be that it's because it's a js file without typing, so
        // omit the types to not have a "cannot use types in jsx" error
        return `{${returnElements.join(' , ')}}`;
    }

    const returnElementsType = names.map(([key, value]) => {
        const identifier = value.identifierText || key;
        if (!value.type) {
            return `${identifier}: typeof ${key}`;
        }

        const containsUndefined = /(^|\s+)undefined(\s+|$)/.test(value.type);
        return `${identifier}${containsUndefined ? '?' : ''}: ${value.type}`;
    });

    return `{${returnElements.join(' , ')}} as {${returnElementsType.join(', ')}}`;
}

export function svelte2tsx(svelte: string, options?: { filename?: string; strictMode?: boolean }) {
    const str = new MagicString(svelte);
    // process the htmlx as a svelte template
    let { moduleScriptTag, scriptTag, slots, uses$$props, uses$$restProps } = processSvelteTemplate(
        str,
    );

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
    let exportedNames = new Map<string, { type?: string; identifierText?: string }>();
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(str, scriptTag);
        exportedNames = res.exportedNames;
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction(
        str,
        scriptTag,
        instanceScriptTarget,
        slots,
        exportedNames,
        uses$$props,
        uses$$restProps,
    );

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(str, moduleScriptTag);
    }

    addComponentExport(
        str,
        uses$$props || uses$$restProps,
        !!options?.strictMode,
        isTsFile(scriptTag, moduleScriptTag),
    );

    return {
        code: str.toString(),
        map: str.generateMap({ hires: true, source: options?.filename }),
    };
}
