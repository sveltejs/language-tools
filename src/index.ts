import MagicString from 'magic-string'
import { parseHtmlx } from './parser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'svelte/compiler'
export { htmlx2jsx } from './htmlxtojsx'
import { createSourceFile, ScriptTarget, ScriptKind, SourceFile, SyntaxKind, VariableStatement, Identifier, FunctionDeclaration, BindingName, ExportDeclaration, ScriptSnapshot, LabeledStatement, ExpressionStatement, BinaryExpression } from 'typescript'







function removeStyleTags(str: MagicString, ast: Node) {
    for (var v of ast.children) {
        let n = v as Node;
        if (n.type == "Style") {
            str.remove(n.start, n.end);
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
        str.prependRight(ls.pos+astOffset+1, `;let ${ident.text}; `)
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
        str.remove(start + astOffset + 1, end + astOffset);
    }

    let statements = tsAst.statements;

    for (let s of statements) {
        if (s.kind == SyntaxKind.VariableStatement) {
            let vs = s as VariableStatement;
            let exportModifier = vs.modifiers 
                                    ? vs.modifiers.find(x => x.kind == SyntaxKind.ExportKeyword)
                                    : null;
            for (let v of vs.declarationList.declarations) {
                if (exportModifier) {
                    addExport(v.name);
                    removeExport(exportModifier.pos, exportModifier.end);
                }
                addDeclaredName(v.name);
            }
        }

        if (s.kind == SyntaxKind.FunctionDeclaration) {
            let fd = s as FunctionDeclaration;
            let exportModifier = fd.modifiers.find(x => x.kind == SyntaxKind.ExportKeyword)
            if (exportModifier) {
                addExport(fd.name)
                removeExport(exportModifier.pos, exportModifier.end);
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


function processScriptTag(str: MagicString, ast: Node) {
    let script: Node = null;

    //find the script
    for (var v of ast.children) {
        let n = v as Node;
        if (n.type == "Script" && n.attributes && !n.attributes.find(a => a.name == "context" && a.value == "module")) {
            script = n;
        }
    }

    let htmlx = str.original;

    if (!script) {
        str.prependRight(0, "</>;function render() {\n<>");
        str.append(";\nreturn {  }}");
        return;
    }

    //move it to the top (the variables need to be declared before the jsx template)
    if (script.start != 0) {
        str.move(script.start, script.end, 0);
    }

    //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
    let scriptTagEnd = htmlx.lastIndexOf(">", script.content.start) + 1;
    str.overwrite(script.start, scriptTagEnd, "</>;function render() {\n");

    let scriptEndTagStart = htmlx.lastIndexOf("<", script.end);
    str.overwrite(scriptEndTagStart, script.end, ";\n<>");

    let tsAst = createSourceFile("component.ts.svelte", htmlx.substring(script.content.start, script.content.end), ScriptTarget.Latest, true, ScriptKind.TS);
    let { exportedNames, declaredNames } = replaceExports(str, tsAst, script.content.start);
   
    declareImplictReactiveVariables(declaredNames, str, tsAst, script.content.start);

    let returnElements = [...exportedNames.entries()].map(([key, value]) => value ? `${value}: ${key}` : key);
    let returnString = "\nreturn { " + returnElements.join(",") + " }}"
    str.append(returnString)
}


function addComponentExport(str: MagicString) {
    str.append("\n\nexport default class {\n    $$prop_def = render()\n}");
}


export function svelte2jsx(svelte: string) {

    let str = new MagicString(svelte);
    let htmlxAst = parseHtmlx(svelte);

    //TODO move script tag to top
    //ensure script at top
    convertHtmlxToJsx(str, htmlxAst)
    removeStyleTags(str, htmlxAst)
    processScriptTag(str, htmlxAst);
    addComponentExport(str);

    return {
        code: str.toString(),
        map: str.generateMap({ hires: true })
    }
}