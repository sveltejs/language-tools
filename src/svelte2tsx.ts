import MagicString from 'magic-string'
import { parseHtmlx } from './parser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'svelte/compiler'
//import { createSourceFile, ScriptTarget, ScriptKind, SourceFile, SyntaxKind, VariableStatement, Identifier, FunctionDeclaration, BindingName, ExportDeclaration, ScriptSnapshot, LabeledStatement, ExpressionStatement, BinaryExpression, Statement } from 'typescript'
import * as ts from 'typescript';

function AttributeValueAsJsExpression(htmlx: string, attr: Node): string {
    if (attr.value.length == 0) return "''"; //wut?

    //handle single value
    if (attr.value.length == 1) {
        let attrVal = attr.value[0];

        if (attrVal.type == "AttributeShorthand") {
            return attrVal.expression.name;
        }

        if (attrVal.type == "Text") {
            return '"' + attrVal.raw + '"';
        }

        if (attrVal.type == "MustacheTag") {
            return htmlx.substring(attrVal.expression.start, attrVal.expression.end)
        }
        throw Error("Unknown attribute value type:" + attrVal.type);
    }

    // we have multiple attribute values, so we build a string out of them. 
    // technically the user can do something funky like attr="text "{value} or even attr=text{value}
    // so instead of trying to maintain a nice sourcemap with prepends etc, we just overwrite the whole thing
    let valueParts = attr.value.map(n => {
        if (n.type == "Text") return '${"' + n.raw + '"}';
        if (n.type == "MustacheTag") return "$" + htmlx.substring(n.start, n.end);
    })
    let valuesAsStringTemplate = "`" + valueParts.join("") + "`";
    return valuesAsStringTemplate;
}


type TemplateProcessResult = {
    uses$$props: boolean,
    slots: Map<string, Map<string, string>>;
    scriptTag: Node,
    moduleScriptTag: Node
}


function processSvelteTemplate(str: MagicString): TemplateProcessResult {
    let htmlxAst = parseHtmlx(str.original);

    let uses$$props = false;
    const handleIdentifier = (node: Node, parent: Node) => {
        if (node.name == "$$props") {
            uses$$props = true; 
            return;
        }

        //handle store
        if (node.name[0] != "$") return;
    
        //handle assign to
        if (parent.type == "AssignmentExpression" && parent.left == node && parent.operator == "=") {
            let dollar = str.original.indexOf("$", node.start);
            str.remove(dollar, dollar+1);
            str.overwrite(node.end, str.original.indexOf("=", node.end)+1, ".set(");
            str.appendLeft(parent.end, ")");
            return;
        }

        //rewrite get
        let dollar = str.original.indexOf("$", node.start);
        str.overwrite(dollar, dollar+1, "__sveltets_store_get(");
        str.appendLeft(node.end, ")")
    }

    let scriptTag: Node = null;
    let moduleScriptTag: Node = null;
    const handleScriptTag = (node: Node) => {
        if (node.attributes && node.attributes.find(a => a.name == "context" && a.value.length == 1 && a.value[0].raw == "module")) {
            moduleScriptTag = node;
        } else {
            scriptTag = node;
        }
    }
    
    let slots = new Map<string, Map<string, string>>();
    const handleSlot = (node: Node) => {
        let nameAttr = node.attributes.find(a => a.name == "name");
        let slotName = nameAttr ? nameAttr.value[0].raw : "default";
        //collect attributes
        let attributes = new Map<string, string>();
        for (let attr of node.attributes) {
            if (attr.name == "name") continue;
            if (!attr.value.length) continue;
            attributes.set(attr.name, AttributeValueAsJsExpression(str.original, attr));
        }
        slots.set(slotName, attributes)
    }    

    const handleStyleTag = (node: Node) => {
        str.remove(node.start, node.end);
    }

    const onHtmlxWalk = (node:Node, parent:Node) => {
        switch(node.type) {
           case "Identifier": handleIdentifier(node, parent); break;
           case "Slot": handleSlot(node); break;
           case "Style": handleStyleTag(node); break;
           case "Script": handleScriptTag(node); break;
        }
    }

    convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk);

    return {
        moduleScriptTag,
        scriptTag,
        slots,
        uses$$props
    }
}

type InstanceScriptProcessResult = {
    exportedNames: Map<string, string>;
    uses$$props: boolean;
}

function processInstanceScriptContent(str: MagicString, script: Node): InstanceScriptProcessResult {
    let htmlx = str.original;
    let tsAst = ts.createSourceFile("component.ts.svelte", htmlx.substring(script.content.start, script.content.end), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let astOffset = script.content.start;

    let exportedNames = new Map<string,string>();
    let declaredTopLevelNames: Set<string> = new Set();
    let implicitTopLevelNames: Map<string, number> = new Map();
    let uses$$props = false;

    const addDeclaredName = (name: ts.BindingName) => {
        if (name.kind == ts.SyntaxKind.Identifier) {
            declaredTopLevelNames.add(name.text);
        }
    }

    const addExport = (name: ts.BindingName, target: ts.BindingName = null) => {
        if (name.kind != ts.SyntaxKind.Identifier) {
            throw Error("export source kind not supported " + name)
        }
        if (target && target.kind != ts.SyntaxKind.Identifier) {
            throw Error("export target kind not supported " + target)
        }
        exportedNames.set(name.text, target ? (target as ts.Identifier).text : null);
    }

    const removeExport = (start: number, end: number) => {
        let exportStart = str.original.indexOf("export", start+astOffset);
        let exportEnd = exportStart + "export".length;
        str.remove(exportStart, exportEnd);
    }

    const handleIdentifier = (ident: ts.Identifier, parent: ts.Node) => {
        if (ident.text == "$$props") {
            uses$$props = true;
            return
        }

        //convert store references
        if (!ident.text.startsWith('$')) return;

        //don't convert labels 
        if (ts.isLabeledStatement(parent)) return;

        //we are a store variable

        //we are on the left, become a "set"
        if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind == ts.SyntaxKind.EqualsToken && parent.left == ident) {
            //remove $
            let dollar = str.original.indexOf("$", ident.pos + astOffset);
            str.remove(dollar, dollar + 1);
            // replace = with .set(
            str.overwrite(ident.end+astOffset, parent.operatorToken.end + astOffset, ".set(");
            // append )
            str.appendLeft(parent.end+astOffset, ")");
            return;
        }

        // we must be on the right or not part of assignment
       
        let dollar = str.original.indexOf("$", ident.pos + astOffset);
        str.overwrite(dollar, dollar+1, "__sveltets_store_get(");
        str.appendLeft(ident.end+astOffset, ")");
    }

    const processChild = (s: ts.Node, parent: ts.Node) => {
        if (ts.isIdentifier(s)) handleIdentifier(s, parent);
        ts.forEachChild(s, n => processChild(n, s));
    }


    const processTopLevelStatement = (s: ts.Statement) => {
        if (ts.isVariableStatement(s)) {
            let exportModifier = s.modifiers ? s.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword): null;
            if (exportModifier) {
                removeExport(exportModifier.pos, exportModifier.end);
            }
            for (let v of s.declarationList.declarations) {
                if (exportModifier) {
                    addExport(v.name);
                }
                addDeclaredName(v.name);
            }
        }

        if (ts.isFunctionDeclaration(s)) {
            if (s.modifiers) {
                let exportModifier = s.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword)
                if (exportModifier) {
                    addExport(s.name)
                    removeExport(exportModifier.pos, exportModifier.end);
                }
            }
            addDeclaredName(s.name);
        }

        if (ts.isExportDeclaration(s)) {
            for (let ne of s.exportClause.elements) {
                if (ne.propertyName) {
                    addExport(ne.propertyName, ne.name)
                } else {
                    addExport(ne.name)
                }
                //we can remove entire statement
                removeExport(s.pos, s.end);
            }
        }

        //move imports to top of script so they appear outside our render function
        if (ts.isImportDeclaration(s)) {
            str.move(s.pos+astOffset, s.end+astOffset, script.start+1);
            str.overwrite(s.end+astOffset-1, s.end+astOffset, '"\n')

            //track the top level declaration
            if (s.importClause) {
                if (s.importClause.name && ts.isIdentifier(s.importClause.name)) {
                    addDeclaredName(s.importClause.name)
                } 
                if (s.importClause.namedBindings && ts.isNamedImports(s.importClause.namedBindings)) {
                    for(let i of s.importClause.namedBindings.elements) {
                        if (ts.isIdentifier(i.name)) {
                            addDeclaredName(i.name)
                        }
                    }
                }
            }
        }

        //track implicit declarations in reactive blocks
        if (ts.isLabeledStatement(s) 
                && s.label.text == "$"
                && s.statement 
                && ts.isExpressionStatement(s.statement)
                && ts.isBinaryExpression(s.statement.expression)
                && s.statement.expression.operatorToken.kind == ts.SyntaxKind.EqualsToken
                && ts.isIdentifier(s.statement.expression.left))   {
                    
            implicitTopLevelNames.set(s.statement.expression.left.text, s.label.pos );
        }
        
        //handle stores etc
        if (ts.isIdentifier(s)) handleIdentifier(s, null);
        
        //to save a bunch of condition checks on each node, we recurse into processChild which skips all the checks for top level items
        return ts.forEachChild(s, n => processChild(n, s))
    }

    tsAst.forEachChild(processTopLevelStatement);

    // declare implicit reactive variables
    for ( var [name, pos]  of implicitTopLevelNames.entries()) {
        if (!declaredTopLevelNames.has(name)) {
            //add a declaration
            str.prependRight(pos + astOffset + 1, `;let ${name}; `)
        }
    }

    return { 
        exportedNames,
        uses$$props
    }
}


function addComponentExport(str: MagicString, uses$$props: boolean) {
    str.append(`\n\nexport default class {\n    $$prop_def = __sveltets_partial${ uses$$props ? "_with_any" : "" }(render().props)\n    $$slot_def = render().slots\n}`);
}

function processModuleScriptTag(str: MagicString, script: Node) {
    let htmlx = str.original;

    let scriptStartTagEnd = htmlx.indexOf(">", script.start)+1;
    let scriptEndTagStart = htmlx.lastIndexOf("<", script.end-1);
  
    str.overwrite(script.start, scriptStartTagEnd, "</>;");
    str.overwrite(scriptEndTagStart, script.end, ";<>");
}



function createRenderFunction(str: MagicString, scriptTag: Node, scriptDestination: number, slots: Map<string, Map<string,string>>, exportedNames: Map<string,string>, uses$$props: boolean) {
    let htmlx = str.original;
    let propsDecl =  uses$$props ? " let $$props: SvelteAllProps;" : ""

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        let scriptTagEnd = htmlx.lastIndexOf(">", scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start+ 1, "</>;");
        str.overwrite(scriptTag.start+1, scriptTagEnd, `function render() {${propsDecl}\n`);

        let scriptEndTagStart = htmlx.lastIndexOf("<", scriptTag.end-1);
        str.overwrite(scriptEndTagStart, scriptTag.end, ";\n<>");
    } else {
        str.prependRight(scriptDestination, `</>;function render() {${propsDecl}\n<>`);
    }

    let returnElements = [...exportedNames.entries()].map(([key, value]) => value ? `${value}: ${key}` : key);
    let slotsAsDef = "{" + [...slots.entries()].map(([name, attrs]) => {
        let attrsAsString = [...attrs.entries()].map(([exportName, expr]) => `${exportName}:${expr}`).join(", ");
        return `${name}: {${attrsAsString}}`
    }).join(", ") + "}"


    let returnString = "\nreturn { props: {" + returnElements.join(" , ") + "}, slots: " + slotsAsDef + " }}"
    str.append(returnString)
}


export function svelte2tsx(svelte: string) {

    let str = new MagicString(svelte);
    // process the htmlx as a svelte template
    let { moduleScriptTag, scriptTag, slots, uses$$props } = processSvelteTemplate(str);
    
    /* Rearrange the script tags so that module is first, and instance second followed finally by the templatet
     * This is a bit convoluted due to some trouble I had with magic string. A simple str.move(start,end,0) for each script wasn't enough
     * since if the module script was already at 0, it wouldn't move (which is fine) but would mean the order would be swapped when the script tag tried to moved to 0
     * instead in this case it has to move to moduleScriptTag.end. We track the location for the script move in the MoveInstanceScriptTarget var
     */
    let instanceScriptTarget = 0;

    if (moduleScriptTag) {
        if (moduleScriptTag.start != 0) {
            //move our module tag to the top
            str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        } else {
            //since our module script was already at position 0, we need to move our script tag to the end of it.
            instanceScriptTarget = moduleScriptTag.end;
        }
    }

    //move the instance script and process the content
    let exportedNames = new Map<string, string>();
    if (scriptTag) {
        //ensure it is betweent he module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        let res = processInstanceScriptContent(str, scriptTag);
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
        map: str.generateMap({ hires: true })
    }
}