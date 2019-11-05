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

function moveInstanceScriptToTop(str: MagicString, ast: Node) {
    for(var v of ast.children) {
        let n = v as Node;
        if (n.type == "Script"  && n.attributes && !n.attributes.find(a => a.name == "context" && a.value == "module")) {
            if (n.start != 0 ) {
                str.move(n.start, n.end, 0);
            }
        }
    }
}


export function svelte2jsx(svelte: string) {

    let str = new MagicString(svelte);
    let htmlxAst = parseHtmlx(svelte);

    //TODO move script tag to top
      //ensure script at top
      moveInstanceScriptToTop(str, htmlxAst);
    convertHtmlxToJsx(str, htmlxAst)
    removeStyleTags(str, htmlxAst)

  

    
    
    

    return {
        code: str.toString(),
        map: str.generateMap({hires: true})
    }
}