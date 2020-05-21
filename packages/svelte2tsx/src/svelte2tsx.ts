import MagicString from 'magic-string';
import { parseHtmlx } from './htmlxparser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'svelte/compiler';
import * as ts from 'typescript';

function AttributeValueAsJsExpression(htmlx: string, attr: Node): string {
    if (attr.value.length == 0) return "''"; //wut?

    //handle single value
    if (attr.value.length == 1) {
        const attrVal = attr.value[0];

        if (attrVal.type == "AttributeShorthand") {
            return attrVal.expression.name;
        }

        if (attrVal.type == "Text") {
            return '"' + attrVal.raw + '"';
        }

        if (attrVal.type == "MustacheTag") {
            return htmlx.substring(attrVal.expression.start, attrVal.expression.end);
        }
        throw Error("Unknown attribute value type:" + attrVal.type);
    }

    // we have multiple attribute values, so we know we are building a string out of them.
    // so return a dummy string, it will typecheck the same :)
    return '"__svelte_ts_string"';
}


type TemplateProcessResult = {
    uses$$props: boolean;
    slots: Map<string, Map<string, string>>;
    scriptTag: Node;
    moduleScriptTag: Node;
}


class Scope {
    declared: Set<string> = new Set()
    parent: Scope

    constructor(parent?: Scope) {
        this.parent = parent;
    }
}

type pendingStoreResolution<T> = {
    node: T;
    parent: T;
    scope: Scope;
}

function processSvelteTemplate(str: MagicString): TemplateProcessResult {
    const htmlxAst = parseHtmlx(str.original);

    let uses$$props = false;

    //track if we are in a declaration scope
    let isDeclaration = false;


    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const pendingStoreResolutions: pendingStoreResolution<Node>[] = [];
    let scope = new Scope();
    const pushScope = () => scope = new Scope(scope);
    const popScope = () => scope = scope.parent;

    const handleStore = (node: Node, parent: Node) => {
        //handle assign to
        if (parent.type == "AssignmentExpression" && parent.left == node && parent.operator == "=") {
            const dollar = str.original.indexOf("$", node.start);
            str.remove(dollar, dollar+1);
            str.overwrite(node.end, str.original.indexOf("=", node.end)+1, ".set(");
            str.appendLeft(parent.end, ")");
            return;
        }

        //rewrite get
        const dollar = str.original.indexOf("$", node.start);
        str.overwrite(dollar, dollar+1, "__sveltets_store_get(");
        str.prependLeft(node.end, ")");
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
        if (node.name == "$$props") {
            uses$$props = true;
            return;
        }

        //handle potential store
        if (node.name[0] == "$") {
            if (isDeclaration) {
                if (parent.type == "Property" && prop == "key") return;
                scope.declared.add(node.name);
            } else {
                if (parent.type == "MemberExpression" && prop == "property") return;
                if (parent.type == "Property" && prop == "key") return;
                pendingStoreResolutions.push({ node, parent, scope });
            }
            return;
        }
    };

    let scriptTag: Node = null;
    let moduleScriptTag: Node = null;
    const handleScriptTag = (node: Node) => {
        if (node.attributes && node.attributes.find(a => a.name == "context" && a.value.length == 1 && a.value[0].raw == "module")) {
            moduleScriptTag = node;
        } else {
            scriptTag = node;
        }
    };

    const slots = new Map<string, Map<string, string>>();
    const handleSlot = (node: Node) => {
        const nameAttr = node.attributes.find(a => a.name == "name");
        const slotName = nameAttr ? nameAttr.value[0].raw : "default";
        //collect attributes
        const attributes = new Map<string, string>();
        for (const attr of node.attributes) {
            if (attr.name == "name") continue;
            if (!attr.value.length) continue;
            attributes.set(attr.name, AttributeValueAsJsExpression(str.original, attr));
        }
        slots.set(slotName, attributes);
    };

    const handleStyleTag = (node: Node) => {
        str.remove(node.start, node.end);
    };


    const onHtmlxWalk = (node: Node, parent: Node, prop: string) => {

        if (prop == "params" && (parent.type == "FunctionDeclaration" || parent.type == "ArrowFunctionExpression")) {
            isDeclaration = true;
        }
        if (prop == "id" && parent.type == "VariableDeclarator") {
            isDeclaration = true;
        }


        switch (node.type) {
           case "Identifier": handleIdentifier(node, parent, prop); break;
           case "Slot": handleSlot(node); break;
           case "Style": handleStyleTag(node); break;
           case "Script": handleScriptTag(node); break;
           case "BlockStatement": enterBlockStatement(); break;
           case "FunctionDeclaration": enterFunctionDeclaration(); break;
           case "ArrowFunctionExpression": enterArrowFunctionExpression(); break;
           case "VariableDeclarator": isDeclaration = true; break;
        }
    };

    const onHtmlxLeave = (node: Node, parent: Node, prop: string, _index: number) => {

        if (prop == "params" && (parent.type == "FunctionDeclaration" || parent.type == "ArrowFunctionExpression")) {
            isDeclaration = false;
        }

        if (prop == "id" && parent.type == "VariableDeclarator") {
            isDeclaration = false;
        }

        switch (node.type) {
           case "BlockStatement": leaveBlockStatement(); break;
           case "FunctionDeclaration": leaveFunctionDeclaration(); break;
           case "ArrowFunctionExpression": leaveArrowFunctionExpression(); break;
        }
    };

    convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk, onHtmlxLeave);

    //resolve stores
    pendingStoreResolutions.map(resolveStore);

    return {
        moduleScriptTag,
        scriptTag,
        slots,
        uses$$props
    };
}

type InstanceScriptProcessResult = {
    exportedNames: Map<string, string>;
    uses$$props: boolean;
}

function processInstanceScriptContent(str: MagicString, script: Node): InstanceScriptProcessResult {
    const htmlx = str.original;
    const scriptContent = htmlx.substring(script.content.start, script.content.end);
    const tsAst = ts.createSourceFile("component.ts.svelte", scriptContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astOffset = script.content.start;
    const exportedNames = new Map<string,string>();

    const implicitTopLevelNames: Map<string, number> = new Map();
    let uses$$props = false;


    //track if we are in a declaration scope
    let isDeclaration = false;

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $
    const pendingStoreResolutions: pendingStoreResolution<ts.Node>[] = [];

    let scope = new Scope();
    const rootScope = scope;

    const pushScope = () => scope = new Scope(scope);
    const popScope = () => scope = scope.parent;

    // eslint-disable-next-line max-len
    const addExport = (name: ts.BindingName, target: ts.BindingName = null, type: ts.TypeNode = null) => {
        if (name.kind != ts.SyntaxKind.Identifier) {
            throw Error("export source kind not supported " + name);
        }
        if (target && target.kind != ts.SyntaxKind.Identifier) {
            throw Error("export target kind not supported " + target);
        }
        if (target) {
          // eslint-disable-next-line max-len
          exportedNames.set(type ? `${name.text} as ${type.getText()}` : name.text, (target as ts.Identifier).text);
        } else {
          exportedNames.set(name.text, null);
        }
    };

    const removeExport = (start: number, end: number) => {
        const exportStart = str.original.indexOf("export", start+astOffset);
        const exportEnd = exportStart + (end - start);
        str.remove(exportStart, exportEnd);
    };

    const handleStore = (ident: ts.Node, parent: ts.Node) => {
        // handle assign to
        // eslint-disable-next-line max-len
        if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind == ts.SyntaxKind.EqualsToken && parent.left == ident) {
              //remove $
              const dollar = str.original.indexOf("$", ident.getStart() + astOffset);
              str.remove(dollar, dollar + 1);
              // replace = with .set(
              str.overwrite(ident.end+astOffset, parent.operatorToken.end + astOffset, ".set(");
              // append )
              str.appendLeft(parent.end+astOffset, ")");
              return;
        }

        // we must be on the right or not part of assignment
        const dollar = str.original.indexOf("$", ident.getStart() + astOffset);
        str.overwrite(dollar, dollar+1, "__sveltets_store_get(");
        str.appendLeft(ident.end+astOffset, ")");
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
        if (ident.text == "$$props") {
            uses$$props = true;
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
                if ((!ts.isPropertyAccessExpression(parent) || parent.expression == ident ) &&
                    (!ts.isPropertyAssignment(parent) || parent.initializer == ident)) {
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
          } else if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
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
            // eslint-disable-next-line max-len
            const exportModifier = node.modifiers ? node.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword): null;
            if (exportModifier) {
                handleExportedVariableDeclarationList(node.declarationList);
                removeExport(exportModifier.getStart(), exportModifier.end);
            }
        }

        if (ts.isFunctionDeclaration(node)) {
            if (node.modifiers) {
                // eslint-disable-next-line max-len
                const exportModifier = node.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword);
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
            for (const ne of node.exportClause.elements) {
                if (ne.propertyName) {
                    addExport(ne.propertyName, ne.name);
                } else {
                    addExport(ne.name);
                }
            }
            //we can remove entire statement
            removeExport(node.getStart(), node.end);
        }

        //move imports to top of script so they appear outside our render function
        if (ts.isImportDeclaration(node)) {
            str.move(node.getStart()+astOffset, node.end+astOffset, script.start+1);
            //add in a \n
            const originalEndChar = str.original[node.end+astOffset-1];
            str.overwrite(node.end+astOffset-1, node.end+astOffset, originalEndChar+"\n");
        }

        if (ts.isVariableDeclaration(parent) && parent.name == node) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => isDeclaration = false);
        }

        if (ts.isBindingElement(parent) && parent.name == node) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => isDeclaration = false);
        }

        if (ts.isImportClause(node)) {
            isDeclaration = true;
            onLeaveCallbacks.push(() => isDeclaration = false);
        }

        //handle stores etc
        if (ts.isIdentifier(node)) handleIdentifier(node, parent);


        //track implicit declarations in reactive blocks at the top level
        if (ts.isLabeledStatement(node)
                && parent == tsAst //top level
                && node.label.text == "$"
                && node.statement
                && ts.isExpressionStatement(node.statement)
                && ts.isBinaryExpression(node.statement.expression)
                && node.statement.expression.operatorToken.kind == ts.SyntaxKind.EqualsToken
                && ts.isIdentifier(node.statement.expression.left))   {

            implicitTopLevelNames.set(node.statement.expression.left.text, node.label.getStart() );
        }

        //to save a bunch of condition checks on each node, we recurse into processChild which skips all the checks for top level items
        ts.forEachChild(node, n => walk(n, node));
        //fire off the on leave callbacks
        onLeaveCallbacks.map(c => c());
    };

    //walk the ast and convert to tsx as we go
    tsAst.forEachChild(n => walk(n, tsAst));

    //resolve stores
    pendingStoreResolutions.map(resolveStore);

    // declare implicit reactive variables we found in the script
    for ( const [name, pos] of implicitTopLevelNames.entries()) {
        if (!rootScope.declared.has(name)) {
            //add a declaration
            str.prependRight(pos + astOffset, `;let ${name}; `);
        }
    }

    return {
        exportedNames,
        uses$$props
    };
}


function addComponentExport(str: MagicString, uses$$props: boolean) {
    str.append(`\n\nexport default class {\n    $$prop_def = __sveltets_partial${ uses$$props ? "_with_any" : "" }(render().props)\n    $$slot_def = render().slots\n}`);
}

function processModuleScriptTag(str: MagicString, script: Node) {
    const htmlx = str.original;

    const scriptStartTagEnd = htmlx.indexOf(">", script.start)+1;
    const scriptEndTagStart = htmlx.lastIndexOf("<", script.end-1);

    str.overwrite(script.start, scriptStartTagEnd, "</>;");
    str.overwrite(scriptEndTagStart, script.end, ";<>");
}

// eslint-disable-next-line max-len
function createRenderFunction(str: MagicString, scriptTag: Node, scriptDestination: number, slots: Map<string, Map<string,string>>, exportedNames: Map<string,string>, uses$$props: boolean) {
    const htmlx = str.original;
    const propsDecl =  uses$$props ? " let $$props: SvelteAllProps;" : "";

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        const scriptTagEnd = htmlx.lastIndexOf(">", scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start+ 1, "</>;");
        str.overwrite(scriptTag.start+1, scriptTagEnd, `function render() {${propsDecl}\n`);

        const scriptEndTagStart = htmlx.lastIndexOf("<", scriptTag.end-1);
        str.overwrite(scriptEndTagStart, scriptTag.end, ";\n<>");
    } else {
        str.prependRight(scriptDestination, `</>;function render() {${propsDecl}\n<>`);
    }

    // eslint-disable-next-line max-len
    const returnElements = [...exportedNames.entries()].map(([key, value]) => value ? `${value}: ${key}` : key);
    const slotsAsDef = "{" + [...slots.entries()].map(([name, attrs]) => {
        const attrsAsString = [...attrs.entries()].map(([exportName, expr]) => `${exportName}:${expr}`).join(", ");
        return `${name}: {${attrsAsString}}`;
    }).join(", ") + "}";


    const returnString = "\nreturn { props: {" + returnElements.join(" , ") + "}, slots: " + slotsAsDef + " }}";
    str.append(returnString);
}


export function svelte2tsx(svelte: string, filename?: string) {

    const str = new MagicString(svelte);
    // process the htmlx as a svelte template
    let { moduleScriptTag, scriptTag, slots, uses$$props } = processSvelteTemplate(str);

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
    let exportedNames = new Map<string, string>();
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(str, scriptTag);
        exportedNames = res.exportedNames;
        uses$$props = uses$$props || res.uses$$props;
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction(str, scriptTag, instanceScriptTarget, slots, exportedNames, uses$$props);

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(str, moduleScriptTag);
    }

    addComponentExport(str, uses$$props);

    return {
        code: str.toString(),
        map: str.generateMap({ hires: true, source: filename })
    };
}
