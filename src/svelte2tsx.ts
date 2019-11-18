import MagicString from 'magic-string'
import { parseHtmlx } from './parser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'svelte/compiler'
import { createSourceFile, ScriptTarget, ScriptKind, SourceFile, SyntaxKind, VariableStatement, Identifier, FunctionDeclaration, BindingName, ExportDeclaration, ScriptSnapshot, LabeledStatement, ExpressionStatement, BinaryExpression } from 'typescript'

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





function processImports(str: MagicString, tsAst: SourceFile, astOffset: number, target: number) {
    for (var st of tsAst.statements) {
        if (st.kind == SyntaxKind.ImportDeclaration) {
            str.move(st.pos+astOffset, st.end+astOffset,target);
            str.overwrite(st.end+astOffset-1, st.end+astOffset, '"\n')
        }
    }
}



function declareImplictReactiveVariables(declaredNames: string[], str: MagicString, tsAst: SourceFile, astOffset: number) {
    for (let le of tsAst.statements) {
        if (le.kind != SyntaxKind.LabeledStatement) continue;
        let ls = le as LabeledStatement;
        if (ls.label.text != "$") continue;
        if (!ls.statement || ls.statement.kind != SyntaxKind.ExpressionStatement) continue;
        let es = ls.statement as ExpressionStatement;
        if (!es.expression || es.expression.kind != SyntaxKind.BinaryExpression) continue;
        let be = es.expression as BinaryExpression;
        if (be.operatorToken.kind != SyntaxKind.EqualsToken
            || be.left.kind != SyntaxKind.Identifier) continue;

        let ident = be.left as Identifier;
        //are we already declared?
        if (declaredNames.find(n => ident.text == n)) continue;
        //add a declaration
        str.prependRight(ls.pos + astOffset + 1, `;let ${ident.text}; `)
    }
}

function replaceExports(str: MagicString, tsAst: SourceFile, astOffset: number) {
    //track a as b exports
    let exportedNames = new Map<string, string>();
    let declaredNames: string[] = [];

    const addDeclaredName = (name: BindingName) => {
        if (name.kind == SyntaxKind.Identifier) {
            declaredNames.push(name.text);
        }
    }

    const addExport = (name: BindingName, target: BindingName = null) => {
        if (name.kind != SyntaxKind.Identifier) {
            throw Error("export source kind not supported " + name)
        }
        if (target && target.kind != SyntaxKind.Identifier) {
            throw Error("export target kind not supported " + target)
        }
        exportedNames.set(name.text, target ? (target as Identifier).text : null);
    }

    const removeExport = (start: number, end: number) => {
        let exportStart = str.original.indexOf("export", start+astOffset);
        let exportEnd = exportStart + "export".length;
        str.remove(exportStart, exportEnd);
    }

    let statements = tsAst.statements;

    for (let s of statements) {
        if (s.kind == SyntaxKind.VariableStatement) {
            let vs = s as VariableStatement;
            let exportModifier = vs.modifiers
                ? vs.modifiers.find(x => x.kind == SyntaxKind.ExportKeyword)
                : null;
            if (exportModifier) {
                removeExport(exportModifier.pos, exportModifier.end);
            }
            for (let v of vs.declarationList.declarations) {
                if (exportModifier) {
                    addExport(v.name);
                }
                addDeclaredName(v.name);
            }
        }

        if (s.kind == SyntaxKind.FunctionDeclaration) {
            let fd = s as FunctionDeclaration;
            if (fd.modifiers) {
                let exportModifier = fd.modifiers.find(x => x.kind == SyntaxKind.ExportKeyword)
                if (exportModifier) {
                    addExport(fd.name)
                    removeExport(exportModifier.pos, exportModifier.end);
                }
            }
            addDeclaredName(fd.name);
        }

        if (s.kind == SyntaxKind.ExportDeclaration) {
            let ed = s as ExportDeclaration;
            for (let ne of ed.exportClause.elements) {
                if (ne.propertyName) {
                    addExport(ne.propertyName, ne.name)
                } else {
                    addExport(ne.name)
                }
                //we can remove entire modifier
                removeExport(ed.pos, ed.end);
            }
        }
    }

    return { exportedNames, declaredNames }
}

function processModuleScriptTag(str: MagicString, script: Node) {
    let htmlx = str.original;

    let scriptStartTagEnd = htmlx.indexOf(">", script.start)+1;
    let scriptEndTagStart = htmlx.lastIndexOf("<", script.end-1);
  
    str.overwrite(script.start, scriptStartTagEnd, "</>;");
    str.overwrite(scriptEndTagStart, script.end, ";<>");
}


type InstanceScriptProcessResult = {
    exportedNames: Map<string, string>;
    uses$$props: boolean;
}

function processInstanceScriptContent(str: MagicString, script: Node): InstanceScriptProcessResult {
    let htmlx = str.original;
    let tsAst = createSourceFile("component.ts.svelte", htmlx.substring(script.content.start, script.content.end), ScriptTarget.Latest, true, ScriptKind.TS);

    let { exportedNames, declaredNames } = replaceExports(str, tsAst, script.content.start);
    declareImplictReactiveVariables(declaredNames, str, tsAst, script.content.start);
    processImports(str, tsAst, script.content.start, script.start+1);
    

    return { 
        exportedNames,
        uses$$props: false
    }
}


function addComponentExport(str: MagicString, uses$$props: boolean) {
    str.append(`\n\nexport default class {\n    $$prop_def = __sveltets_partial${ uses$$props ? "_with_any" : "" }(render().props)\n    $$slot_def = render().slots\n}`);
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
    const handleIdentifier = (node: Node) => {
        if (node.name == "$$props") {
            uses$$props = true; 
            return;
        }
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

    const onHtmlxWalk = (node:Node) => {
        switch(node.type) {
           case "Identifier": handleIdentifier(node); break;
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


function createRenderFunction(str: MagicString, scriptTag: Node, scriptDestination: number, slots: Map<string, Map<string,string>>, exportedNames: Map<string,string>) {
    let htmlx = str.original;

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        let scriptTagEnd = htmlx.lastIndexOf(">", scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start+ 1, "</>;");
        str.overwrite(scriptTag.start+1, scriptTagEnd, "function render() {\n");

        let scriptEndTagStart = htmlx.lastIndexOf("<", scriptTag.end-1);
        str.overwrite(scriptEndTagStart, scriptTag.end, ";\n<>");
    } else {
        str.prependRight(scriptDestination, "</>;function render() {\n<>");
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
    createRenderFunction(str, scriptTag, instanceScriptTarget, slots, exportedNames);
    
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