
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

        // {:else} -> </>} else {<>
        if (ifBlock.else) {
            let elseEnd = htmlx.lastIndexOf("}", ifBlock.else.start)
            let elseStart = htmlx.lastIndexOf("{", elseEnd)
            str.overwrite(elseStart, elseStart+1, "</>}")
            str.overwrite(elseEnd, elseEnd+1,"{<>")
            let colon = htmlx.indexOf(":", elseStart);
            str.remove(colon, colon+1);
        }

        // {/if} -> </>}}}</>
        let endif = htmlx.lastIndexOf("{", ifBlock.end);
        str.overwrite(endif, ifBlock.end, "</>}}}");
    }

    const handleEach = (eachBlock: Node) => {
        
        // {#each items as item,i (key)} ->
        // {(items).map((item,i) => (key) && <>
        str.overwrite(eachBlock.start, eachBlock.expression.start, "{(");
        str.overwrite(eachBlock.expression.end,  eachBlock.context.start, ").map((");
        
        
        let contextEnd = eachBlock.context.end;
        if (eachBlock.index) {
            let idxLoc = htmlx.indexOf(eachBlock.index, contextEnd);
            contextEnd = idxLoc + eachBlock.index.length;
        }
        str.prependLeft(contextEnd, ") =>")
        
        if (eachBlock.key) {
            let endEachStart = htmlx.indexOf("}", eachBlock.key.end);
            str.overwrite(endEachStart,endEachStart+1," && <>"); 
        } else {
            let endEachStart = htmlx.indexOf("}", contextEnd);
            str.overwrite(endEachStart,endEachStart+1," <>"); 
        }

        let endEach = htmlx.lastIndexOf("{", eachBlock.end);

        // {/each} -> </>)} or {:else} -> </>)}
        if (eachBlock.else) {
            let elseEnd = htmlx.lastIndexOf("}", eachBlock.else.start)
            let elseStart = htmlx.lastIndexOf("{", elseEnd)
            str.overwrite(elseStart,elseEnd+1,"</>)}")
            str.remove(endEach, eachBlock.end);
        } else {
            str.overwrite(endEach, eachBlock.end, "</>)}");
        }


    }






    walk(ast, {
        enter: (node:Node, parent, prop, index) => {
            if (node.type == "IfBlock") handleIf(node);
            if (node.type == "EachBlock") handleEach(node);
        }
    })

    return {
        map: str.generateMap({ hires: true }),
        code:  str.toString(),
    }
}


