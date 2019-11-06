import MagicString from 'magic-string';
import { walk, Node } from 'estree-walker';
import { parseHtmlx } from './parser';


export function convertHtmlxToJsx(str: MagicString, ast: Node) {
    let htmlx = str.original;
    str.prepend("<>");
    str.append("</>");
    const handleRaw = (rawBlock: Node) => {
        let tokenStart = htmlx.indexOf("@html", rawBlock.start);
        str.remove(tokenStart, "@html".length + 1);
    };
    const handleDebug = (debugBlock: Node) => {
        let tokenStart = htmlx.indexOf("@debug", debugBlock.start);
        str.remove(tokenStart, "@debug".length + 1);
    };
    const handleIf = (ifBlock: Node) => {
        // {#if expr} ->
        // {() => { if (expr) { <>
        str.overwrite(ifBlock.start, ifBlock.expression.start, "{() => {if (");
        let end = htmlx.indexOf("}", ifBlock.expression.end);
        str.appendLeft(ifBlock.expression.end, ")");
        str.overwrite(end, end + 1, "{<>");
        // {:else} -> </>} else {<>
        if (ifBlock.else) {
            let elseEnd = htmlx.lastIndexOf("}", ifBlock.else.start);
            let elseStart = htmlx.lastIndexOf("{", elseEnd);
            str.overwrite(elseStart, elseStart + 1, "</>}");
            str.overwrite(elseEnd, elseEnd + 1, "{<>");
            let colon = htmlx.indexOf(":", elseStart);
            str.remove(colon, colon + 1);
        }
        // {/if} -> </>}}}</>
        let endif = htmlx.lastIndexOf("{", ifBlock.end);
        str.overwrite(endif, ifBlock.end, "</>}}}");
    };
    const handleEach = (eachBlock: Node) => {
        // {#each items as item,i (key)} ->
        // {(items).map((item,i) => (key) && <>
        str.overwrite(eachBlock.start, eachBlock.expression.start, "{(");
        str.overwrite(eachBlock.expression.end, eachBlock.context.start, ").map((");
        let contextEnd = eachBlock.context.end;
        if (eachBlock.index) {
            let idxLoc = htmlx.indexOf(eachBlock.index, contextEnd);
            contextEnd = idxLoc + eachBlock.index.length;
        }
        str.prependLeft(contextEnd, ") =>");
        if (eachBlock.key) {
            let endEachStart = htmlx.indexOf("}", eachBlock.key.end);
            str.overwrite(endEachStart, endEachStart + 1, " && <>");
        }
        else {
            let endEachStart = htmlx.indexOf("}", contextEnd);
            str.overwrite(endEachStart, endEachStart + 1, " <>");
        }
        let endEach = htmlx.lastIndexOf("{", eachBlock.end);
        // {/each} -> </>)} or {:else} -> </>)}
        if (eachBlock.else) {
            let elseEnd = htmlx.lastIndexOf("}", eachBlock.else.start);
            let elseStart = htmlx.lastIndexOf("{", elseEnd);
            str.overwrite(elseStart, elseEnd + 1, "</>)}");
            str.remove(endEach, eachBlock.end);
        }
        else {
            str.overwrite(endEach, eachBlock.end, "</>)}");
        }
    };
    // {#await somePromise then value} ->
    // {() => {let _$$p = (somePromise);
    const handleAwait = (awaitBlock: Node) => {
        str.overwrite(awaitBlock.start, awaitBlock.expression.start, "{() => {let _$$p = (");
        str.prependLeft(awaitBlock.expression.end, ");");
        // then value } | {:then value} ->
        // _$$p.then((value) => {<>
        let thenStart: number;
        let thenEnd: number;
        if (!awaitBlock.pending.skip) {
            //thenBlock seems to include the {:then} tag
            thenStart = awaitBlock.then.start;
            thenEnd = htmlx.indexOf("}", thenStart) + 1;
            str.prependLeft(thenStart, "</>; ");
            // add the start tag too
            let awaitEnd = htmlx.indexOf("}", awaitBlock.expression.end);
            str.remove(awaitEnd, awaitEnd + 1);
            str.appendRight(awaitEnd, " <>");
        }
        else {
            thenEnd = htmlx.lastIndexOf("}", awaitBlock.then.start) + 1;
            thenStart = htmlx.indexOf("then", awaitBlock.expression.end);
        }
        // console.log("overwriting",thenStart, thenEnd);
        str.overwrite(thenStart, thenEnd, "_$$p.then((" + awaitBlock.value + ") => {<>");
        //{:catch error} ->
        //</>}).catch((error) => {<>
        if (!awaitBlock.catch.skip) {
            //catch block includes the {:catch}
            let catchStart = awaitBlock.catch.start;
            let catchSymbolEnd = htmlx.indexOf(":catch", catchStart) + ":catch".length;
            let errorStart = awaitBlock.error ? htmlx.indexOf(awaitBlock.error, catchSymbolEnd) : catchSymbolEnd;
            let errorEnd = awaitBlock.error ? errorStart + awaitBlock.error.length : errorStart;
            let catchEnd = htmlx.indexOf("}", awaitBlock.catch.start) + 1;
            str.overwrite(catchStart, errorStart, "</>}).catch((");
            str.overwrite(errorEnd, catchEnd, ") => {<>");
        }
        // {/await} ->
        // <>})}
        let awaitEndStart = htmlx.lastIndexOf("{", awaitBlock.end);
        str.overwrite(awaitEndStart, awaitBlock.end, "</>})}}");
    };
    walk(ast, {
        enter: (node: Node, parent, prop, index) => {
            if (node.type == "IfBlock")
                handleIf(node);
            if (node.type == "EachBlock")
                handleEach(node);
            if (node.type == "AwaitBlock")
                handleAwait(node);
            if (node.type == "RawMustacheTag")
                handleRaw(node);
            if (node.type == "DebugTag")
                handleDebug(node);
        }
    });
}

export function htmlx2jsx(htmlx: string) {
    let ast = parseHtmlx(htmlx);
    let str = new MagicString(htmlx)

    convertHtmlxToJsx(str, ast);

    return {
        map: str.generateMap({ hires: true }),
        code:  str.toString(),
    }
}