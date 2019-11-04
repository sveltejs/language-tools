
import { parseHtmlx } from './parser'
import MagicString from 'magic-string'
import { walk, Node } from 'estree-walker';

export function htmlx2jsx(htmlx: string) {
    let ast = parseHtmlx(htmlx);
    let str = new MagicString(htmlx)

    str.prepend("<>");
    str.append("</>");


    const handleIf = (ifBlock: Node) => {
        // {#if expr} ->
        // {() => { if (expr) { <>
        str.overwrite(ifBlock.start, ifBlock.expression.start, "{() => {if (");
        let end = htmlx.indexOf("}",  ifBlock.expression.end);
        str.appendLeft(ifBlock.expression.end, ")");
        str.overwrite(end, end+1, "{<>")

        // {/if} -> </>}}}</>
        let endif = htmlx.lastIndexOf("{", ifBlock.end);
        str.overwrite(endif, ifBlock.end, "</>}}}");
    }


    walk(ast, {
        enter: (node:Node, parent, prop, index) => {
            if (node.type == "IfBlock") handleIf(node);
        }
    })

    return {
        map: str.generateMap({ hires: true }),
        code:  str.toString(),
    }
}


