import parse5, { DefaultTreeDocumentFragment, DefaultTreeElement, DefaultTreeTextNode, DefaultTreeNode } from 'parse5'
import compiler from 'svelte/compiler'
import { Node } from 'svelte/types/compiler/interfaces';



function walkAst(doc: DefaultTreeElement, action: (c: DefaultTreeElement) => void) {
    action(doc);
    if (!doc.childNodes) return;
    for (let i = 0; i < doc.childNodes.length; i++) {
        walkAst(doc.childNodes[i] as DefaultTreeElement, action);
    }
}

export function findVerbatimElements(htmlx: string) {
    let elements:Node[] = []
    let tag_names = ['script', 'style'];
    
    let doc: DefaultTreeDocumentFragment = parse5.parseFragment (htmlx, { sourceCodeLocationInfo: true }) as DefaultTreeDocumentFragment;
    
    walkAst(doc as DefaultTreeElement, el => {
        if (tag_names.includes(el.nodeName)) {
            let content =  (el.childNodes && el.childNodes.length > 0) ? el.childNodes[0] as DefaultTreeTextNode : null;
            elements.push({
                start: el.sourceCodeLocation.startOffset,
                end: el.sourceCodeLocation.endOffset,
                type: el.nodeName[0].toUpperCase() + el.nodeName.substr(1),
                attributes: !el.attrs ? [] : el.attrs.map(a => {return {
                    type: "Attribute",
                    name: a.name,
                    value: [{
                        type: "Text",
                        start: htmlx.indexOf("=", el.sourceCodeLocation.attrs[a.name].startOffset) +1,
                        end: el.sourceCodeLocation.attrs[a.name].endOffset,
                        raw: a.value,
                    }],
                    start: el.sourceCodeLocation.attrs[a.name].startOffset,
                    end: el.sourceCodeLocation.attrs[a.name].endOffset
                }}),
                content: !content ? null : {
                    type: "Text",
                    start: content.sourceCodeLocation.startOffset,
                    end: content.sourceCodeLocation.endOffset,
                    value: content.value,
                    raw: content.value
                }
            });
        }
    });

    return elements;
}


export function blankVerbatimContent(htmlx: string, verbatimElements: Node[]) {
    let output = htmlx;
    for (var node of verbatimElements) {
        let content = node.content;
        if (content) {
            output = output.substring(0, content.start)
                                + output.substring(content.start, content.end).replace(/[^\n]/g, " ")
                                + output.substring(content.end);
        }
    }
    return output
}


export function parseHtmlx(htmlx: string): Node {
    //Svelte tries to parse style and script tags which doesn't play well with typescript, so we blank them out. 
    //HTMLx spec says they should just be retained after processing as is, so this is fine
    let verbatimElements = findVerbatimElements(htmlx);
    let deconstructed = blankVerbatimContent(htmlx, verbatimElements);
    
    //extract the html content parsed as htmlx this excludes our script and style tags
    let svelteHtmlxAst = compiler.parse(deconstructed).html; 
    
    //restore our script and style tags as nodes to maintain validity with HTMLx
    for (var s of verbatimElements) {
        svelteHtmlxAst.children.push(s);
        svelteHtmlxAst.start = Math.min(svelteHtmlxAst.start, s.start);
        svelteHtmlxAst.end = Math.max(svelteHtmlxAst.end, s.end);
    }
    return svelteHtmlxAst;
}
