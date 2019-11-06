import MagicString from 'magic-string'
import { parseHtmlx } from './parser';
import { convertHtmlxToJsx } from './htmlxtojsx';
import { Node } from 'svelte/compiler'
export { htmlx2jsx } from './htmlxtojsx'





function removeStyleTags(str: MagicString, ast: Node) {
    for(var v of ast.children) {
        let n = v as Node;
        if (n.type == "Style") {
            str.remove(n.start, n.end);
        }
    }
}

function processScriptTag(str: MagicString, ast: Node) {
    let script: Node = null;
    
    //find the script
    for(var v of ast.children) {
        let n = v as Node;
        if (n.type == "Script"  && n.attributes && !n.attributes.find(a => a.name == "context" && a.value == "module")) {
            script = n;
        }
    }

    //move it to the top (the variables need to be declared before the jsx template)
    if (script.start != 0 ) {
        str.move(script.start, script.end, 0);
    }

    let htmlx = str.original;
    //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
    
    let scriptTagEnd = htmlx.lastIndexOf(">", script.content.start) +1;
    str.overwrite(script.start, scriptTagEnd, "</>;function render() {");

    let scriptEndTagStart = htmlx.lastIndexOf("<", script.end);
    str.overwrite(scriptEndTagStart, script.end, ";\n<>");
}


export function svelte2jsx(svelte: string) {

    let str = new MagicString(svelte);
    let htmlxAst = parseHtmlx(svelte);

    //TODO move script tag to top
      //ensure script at top
      convertHtmlxToJsx(str, htmlxAst)
      removeStyleTags(str, htmlxAst)
      processScriptTag(str, htmlxAst);
      
      str.append("\n\nexport default class {\n    $$prop_def = render()\n}");

    
    
    

    return {
        code: str.toString(),
        map: str.generateMap({hires: true})
    }
}