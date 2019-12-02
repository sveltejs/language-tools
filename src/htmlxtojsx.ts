import MagicString from 'magic-string';
import svelte from 'svelte/compiler';
import { Node } from 'estree-walker';
import { parseHtmlx } from './htmlxparser';
import KnownEvents from './knownevents';
import svgAttributes from './svgattributes';

type ElementType = String
const oneWayBindingAttributes:Map<String, ElementType> = new Map(
    ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight'].map(e => [e, 'HTMLDivElement'] as [String, String]).concat(
    ['duration','buffered','seekable','seeking', 'played', 'ended'].map(e => [e, 'HTMLMediaElement'])
 ));


export function convertHtmlxToJsx(str: MagicString, ast: Node, onWalk: (node: Node, parent: Node, prop:string, index: number) => void = null, onLeave: (node: Node, parent: Node, prop: string, index: number) => void = null) {
    let htmlx = str.original;
    str.prepend("<>");
    str.append("</>");
    const handleRaw = (rawBlock: Node) => {
        let tokenStart = htmlx.indexOf("@html", rawBlock.start);
        str.remove(tokenStart, tokenStart + "@html".length);
    };
    const handleDebug = (debugBlock: Node) => {
        let tokenStart = htmlx.indexOf("@debug", debugBlock.start);
        str.remove(tokenStart, tokenStart + "@debug".length);
    };

    const handleEventHandler = (attr: Node, parent: Node) => {
        let jsxEventName = `${attr.name.toLowerCase()}`

        if (parent.type == "Element" && KnownEvents.indexOf('on'+jsxEventName) >= 0) {
            if (attr.expression) {
                let endAttr = htmlx.indexOf("=", attr.start)
                str.overwrite(attr.start+'on:'.length-1, endAttr, jsxEventName)
                if (htmlx[attr.end - 1] == '"') {
                    let firstQuote = htmlx.indexOf('"', endAttr);
                    str.remove(firstQuote, firstQuote + 1);
                    str.remove(attr.end - 1, attr.end);
                }
            } else {
                str.overwrite(attr.start+'on:'.length-1, attr.end, `${jsxEventName}={null}`)
            }
        } else {
            //We don't know the type of the event handler
            if (attr.expression) {
                //for handler assignment, we changeIt to call to our __sveltets_ensureFunction
                str.remove(attr.start, attr.expression.start);
                str.prependRight(attr.expression.start, "{...__sveltets_ensureFunction((")
                str.overwrite(attr.expression.end, attr.end, "))}");
            } else {
                //for passthrough handlers, we just remove
                str.remove(attr.start, attr.end)
            }
        }
    }

    const handleClassDirective = (attr: Node) => {
        let needCurly = (attr.expression.start == attr.start + "class:".length);
        str.overwrite(attr.start, attr.expression.start, `{...__sveltets_ensureType(Boolean, !!(`)
        str.appendLeft(attr.expression.end, `))${needCurly ? "}" : ""}`)
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    }

    const handleActionDirective = (attr: Node) => {
        str.overwrite(attr.start, attr.start + "use:".length, "{...__sveltets_ensureAction(")

        if (!attr.expression) {
            str.appendLeft(attr.end, ")}");
            return;
        }

        str.overwrite(attr.start + `use:${attr.name}`.length, attr.expression.start, ",")
        str.appendLeft(attr.expression.end, ")");
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    }

    const handleTransitionDirective = (attr: Node) => {
        str.overwrite(attr.start, htmlx.indexOf(":", attr.start) + 1, "{...__sveltets_ensureTransition(")

        if (!attr.expression) {
            str.appendLeft(attr.end, ")}");
            return;
        }
        str.overwrite(htmlx.indexOf(":", attr.start) + 1 + `${attr.name}`.length, attr.expression.start, ", ")
        str.appendLeft(attr.expression.end, ")");
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    }

    const handleAnimateDirective = (attr: Node) => {
        str.overwrite(attr.start, htmlx.indexOf(":", attr.start) + 1, "{...__sveltets_ensureAnimation(")

        if (!attr.expression) {
            str.appendLeft(attr.end, ")}");
            return;
        }
        str.overwrite(htmlx.indexOf(":", attr.start) + 1 + `${attr.name}`.length, attr.expression.start, ", ")
        str.appendLeft(attr.expression.end, ")");
        if (htmlx[attr.end - 1] == '"') {
            str.remove(attr.end - 1, attr.end);
        }
    }

    const handleBinding = (attr: Node, el: Node) => {
        //bind group on input
        if (attr.name == "group" && el.name == "input") {
            str.remove(attr.start, attr.expression.start);
            str.appendLeft(attr.expression.start, "{...__sveltets_ensureType(String, ")
            str.overwrite(attr.expression.end, attr.end, ")}")
            return;
        }

        //bind this on element
        if (attr.name == "this" && el.type == "Element") {
            str.remove(attr.start, attr.expression.start)
            str.appendLeft(attr.expression.start, "{...__sveltets_ensureType(HTMLElement, ");
            str.overwrite(attr.expression.end, attr.end, ")}");
            return;
        }

        //bind this on component
        if (attr.name == "this" && el.type == "InlineComponent") {
            str.remove(attr.start, attr.expression.start)
            str.appendLeft(attr.expression.start, `{...__sveltets_ensureType(${el.name}, `);
            str.overwrite(attr.expression.end, attr.end, ")}");
            return;
        }

        //one way binding
        if (oneWayBindingAttributes.has(attr.name) && el.type == "Element") {
            str.remove(attr.start, attr.expression.start)
            str.appendLeft(attr.expression.start, `{...__sveltets_any(`);
            if (attr.expression.end == attr.end) {
                str.appendLeft(attr.end,  `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`)
            } else {
                str.overwrite(attr.expression.end, attr.end, `=__sveltets_instanceOf(${oneWayBindingAttributes.get(attr.name)}).${attr.name})}`)
            }
            return;
        }


        str.remove(attr.start, attr.start + "bind:".length);
        if (attr.expression.start == attr.start + "bind:".length) {
            str.appendLeft(attr.end, `={${attr.name}}`);
            return
        }

        //remove possible quotes
        if (htmlx[attr.end - 1] == '"') {
            let firstQuote = htmlx.indexOf('"', attr.start);
            str.remove(firstQuote, firstQuote + 1);
            str.remove(attr.end - 1, attr.end);
        }

    }

    const handleSlot = (slotEl: Node, componentName: string, slotName: string) => {
        //collect "let" definitions
        let hasMoved = false;
        for (let attr of slotEl.attributes) {
            if (attr.type != "Let") continue;

            if (slotEl.children.length == 0) {
                //no children anyway, just wipe out the attribute
                str.remove(attr.start, attr.end);
                continue;
            }
            var afterTag = afterTag || htmlx.lastIndexOf(">", slotEl.children[0].start) + 1;

            str.move(attr.start, attr.end, afterTag);

            //remove let:
            if (hasMoved) {
                str.overwrite(attr.start, attr.start + "let:".length, ", ");
            } else {
                str.remove(attr.start, attr.start + "let:".length);
            }
            hasMoved = true;
            if (attr.expression) {
                //overwrite the = as a : 
                let equalSign = htmlx.lastIndexOf("=", attr.expression.start);
                let curly = htmlx.lastIndexOf("{", attr.expression.start);
                str.overwrite(equalSign, curly + 1, ":");
                str.remove(attr.expression.end, attr.end);
            }
        }
        if (!hasMoved) return;
        str.appendLeft(afterTag, "{() => { let {");
        str.appendRight(afterTag, "} = __sveltets_instanceOf(" + componentName + ").$$slot_def." + slotName + ";<>")

        let closeTagStart = htmlx.lastIndexOf("<", slotEl.end)
        str.appendLeft(closeTagStart, "</>}}")
    }


    const handleComponent = (el: Node) => {
        //we need to remove : if it is a svelte component
        if (el.name.startsWith("svelte:")) {
            let colon = htmlx.indexOf(":", el.start);
            str.remove(colon, colon+1);

            let closeTag = htmlx.lastIndexOf("/"+el.name, el.end)
            if (closeTag > el.start) {
                let colon = htmlx.indexOf(":",closeTag)
                str.remove(colon, colon + 1);
            }
        }

        //we only need to do something if there is a let or slot
        handleSlot(el, el.name, "default");

        //walk the direct children looking for slots. We do this here because we need the name of our component for handleSlot
        //we could lean on leave/enter, but I am lazy
        if (!el.children) return;
        for (let child of el.children) {
            if (!child.attributes) continue;
            let slot = child.attributes.find(a => a.name == "slot");
            if (slot) {
                if (slot.value && slot.value.length) {
                    handleSlot(child, el.name, slot.value[0].raw)
                }
            }
        }
    }

    const handleAttribute = (attr: Node, parent: Node) => {

        //if we are on an "element" we are case insensitive, lowercase to match our JSX
        if (parent.type == "Element") {
            //skip Attribute shorthand, that is handled below
            if (attr.value === true || (attr.value.length && attr.value.length == 1 && attr.value[0].type != "AttributeShorthand")) {
                str.overwrite(attr.start, attr.start + attr.name.length, svgAttributes.find(a => a == attr.name) ? attr.name : attr.name.toLowerCase())
           }
        }



        //we are a bare attribute
        if (attr.value === true) return;
        
        if (attr.value.length == 0) return; //wut?
        //handle single value
        if (attr.value.length == 1) {
            let attrVal = attr.value[0];

            if (attr.name == "slot") {
                str.remove(attr.start, attr.end);
                return;
            }

            if (attrVal.type == "AttributeShorthand") {
                let attrName = attrVal.expression.name
                if (parent.type == "Element") {
                   attrName = svgAttributes.find(a => a == attrName) ? attrName :attrName.toLowerCase()
                }

                str.appendRight(attr.start, `${attrName}=`);
                return;
            }

            let equals = htmlx.lastIndexOf("=", attrVal.start);
            if (attrVal.type == "Text") {
                if (attrVal.end == attr.end) {
                    //we are not quoted. Add some
                    str.prependRight(equals + 1, '"');
                    str.appendLeft(attr.end, '"');
                }
                return;
            }

            if (attrVal.type == "MustacheTag") {
                //if the end doesn't line up, we are wrapped in quotes
                if (attrVal.end != attr.end) {
                    str.remove(attrVal.start - 1, attrVal.start);
                    str.remove(attr.end - 1, attr.end);
                }
                return;
            }
            return;
        }

        // we have multiple attribute values, so we build a string out of them. 
        // technically the user can do something funky like attr="text "{value} or even attr=text{value}
        // so instead of trying to maintain a nice sourcemap with prepends etc, we just overwrite the whole thing
  
        let equals = htmlx.lastIndexOf("=", attr.value[0].start);
        str.overwrite(equals, attr.value[0].start, "={`");

        for(let n of attr.value) {
            if (n.type == "MustacheTag") {
                str.appendRight(n.start, "$")
            }
        }

        if (htmlx[attr.end-1] == '"') {
            str.overwrite(attr.end-1, attr.end, "`}")
        } else {
            str.appendLeft(attr.end, "`}")
        }
        
    }

    const handleElement = (attr: Node) => {
        //we just have to self close void tags since jsx always wants the />
        let voidTags = "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr".split(',');
        if (voidTags.find(x => x == attr.name)) {
            if (htmlx[attr.end - 2] != '/') {
                str.appendRight(attr.end - 1, "/");
            }
        }
    }

    const handleIf = (ifBlock: Node) => {
        if (ifBlock.elseif) {
            //we are an elseif so our work is easier
            str.appendLeft(ifBlock.expression.start,"(")
            str.appendLeft(ifBlock.expression.end, ")");
            return;  
        } 
        // {#if expr} ->
        // {() => { if (expr) { <>
        str.overwrite(ifBlock.start, ifBlock.expression.start, "{() => {if (");
        let end = htmlx.indexOf("}", ifBlock.expression.end);
        str.appendLeft(ifBlock.expression.end, ")");
        str.overwrite(end, end + 1, "{<>");

        // {/if} -> </>}}}</>
        let endif = htmlx.lastIndexOf("{", ifBlock.end);
        str.overwrite(endif, ifBlock.end, "</>}}}");
    };

     // {:else} -> </>} else {<>
    const handleElse = (elseBlock: Node, parent: Node) => {
        if (parent.type != "IfBlock") return;
        let elseEnd = htmlx.lastIndexOf("}", elseBlock.start);
        let elseword = htmlx.lastIndexOf(":else", elseEnd);
        let elseStart = htmlx.lastIndexOf("{", elseword);
        str.overwrite(elseStart, elseStart + 1, "</>}");
        str.overwrite(elseEnd, elseEnd + 1, "{<>");
        let colon = htmlx.indexOf(":", elseword);
        str.remove(colon, colon + 1);
    }

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

    const handleComment = (node: Node) => {
        str.remove(node.start, node.end);
    }

    const handleSvelteTag = (node: Node) => {
        let colon = htmlx.indexOf(":", node.start);
        str.remove(colon, colon + 1);

        let closeTag = htmlx.lastIndexOf("/"+node.name, node.end)
        if (closeTag > node.start) {
            let colon = htmlx.indexOf(":",closeTag)
            str.remove(colon, colon + 1);
        }
    }
  

   (svelte as any).walk(ast, {
        enter: (node: Node, parent: Node, prop: string, index: number) => {
            try {
                switch (node.type) {
                    case "IfBlock": handleIf(node); break;
                    case "EachBlock": handleEach(node); break;
                    case "ElseBlock": handleElse(node, parent); break;
                    case "AwaitBlock": handleAwait(node); break;
                    case "RawMustacheTag": handleRaw(node); break;
                    case "DebugTag": handleDebug(node); break;
                    case "InlineComponent": handleComponent(node); break;
                    case "Element": handleElement(node); break;
                    case "Comment": handleComment(node); break;
                    case "Binding": handleBinding(node, parent); break;
                    case "Class": handleClassDirective(node); break;
                    case "Action": handleActionDirective(node); break;
                    case "Transition": handleTransitionDirective(node); break;
                    case "Animation": handleAnimateDirective(node); break;
                    case "Attribute": handleAttribute(node, parent); break;
                    case "EventHandler": handleEventHandler(node, parent); break;
                    case "Options": handleSvelteTag(node); break;
                    case "Window": handleSvelteTag(node); break;
                    case "Head": handleSvelteTag(node); break;
                    case "Body": handleSvelteTag(node); break;
                }
                if (onWalk) onWalk(node, parent, prop, index);
            } catch (e) {
                console.error("Error walking node ", node);
                throw e;
            }
        },

        leave:  (node: Node, parent: Node, prop: string, index: number ) => {
            try {
                if (onLeave) onLeave(node, parent, prop, index);
            } catch (e) {
                console.error("Error leaving node ", node);
                throw e;
            }
        }
    });
}

export function htmlx2jsx(htmlx: string) {
    let ast = parseHtmlx(htmlx);
    let str = new MagicString(htmlx)

    convertHtmlxToJsx(str, ast);

    return {
        map: str.generateMap({ hires: true }),
        code: str.toString(),
    }
}