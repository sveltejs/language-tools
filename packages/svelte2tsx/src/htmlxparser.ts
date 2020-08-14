import compiler from 'svelte/compiler';
import { Node } from 'estree-walker';

function parseAttributeValue(value: string): string {
    return /^['"]/.test(value) ? value.slice(1, -1) : value;
}

function parseAttributes(str: string, start: number) {
    const attrs: Node[] = [];
    str.split(/\s+/)
        .filter(Boolean)
        .forEach((attr) => {
            const attrStart = start + str.indexOf(attr);
            const [name, value] = attr.split('=');
            attrs[name] = value ? parseAttributeValue(value) : name;
            attrs.push({
                type: 'Attribute',
                name,
                value: !value || [
                    {
                        type: 'Text',
                        start: attrStart + attr.indexOf('=') + 1,
                        end: attrStart + attr.length,
                        raw: parseAttributeValue(value),
                    },
                ],
                start: attrStart,
                end: attrStart + attr.length,
            });
        });

    return attrs;
}

function extractTag(htmlx: string, tag: 'script' | 'style') {
    const exp = new RegExp(`(<${tag}([\\S\\s]*?)>)([\\S\\s]*?)<\\/${tag}>`, 'g');
    const matches: Node[] = [];

    let match: RegExpExecArray | null = null;
    while ((match = exp.exec(htmlx)) != null) {
        const content = match[3];

        if (!content) {
            // Self-closing/empty tags don't need replacement
            continue;
        }

        const start = match.index + match[1].length;
        const end = start + content.length;
        const containerStart = match.index;
        const containerEnd = match.index + match[0].length;

        matches.push({
            start: containerStart,
            end: containerEnd,
            type: tag === 'style' ? 'Style' : 'Script',
            attributes: parseAttributes(match[2], containerStart + `<${tag}`.length),
            content: {
                type: 'Text',
                start,
                end,
                value: content,
                raw: content,
            },
        });
    }

    return matches;
}

function findVerbatimElements(htmlx: string) {
    return [...extractTag(htmlx, 'script'), ...extractTag(htmlx, 'style')];
}

function blankVerbatimContent(htmlx: string, verbatimElements: Node[]) {
    let output = htmlx;
    for (const node of verbatimElements) {
        const content = node.content;
        if (content) {
            output =
                output.substring(0, content.start) +
                output.substring(content.start, content.end).replace(/[^\n]/g, ' ') +
                output.substring(content.end);
        }
    }
    return output;
}

export function parseHtmlx(htmlx: string): Node {
    //Svelte tries to parse style and script tags which doesn't play well with typescript, so we blank them out.
    //HTMLx spec says they should just be retained after processing as is, so this is fine
    const verbatimElements = findVerbatimElements(htmlx);
    const deconstructed = blankVerbatimContent(htmlx, verbatimElements);

    //extract the html content parsed as htmlx this excludes our script and style tags
    const svelteHtmlxAst = compiler.parse(deconstructed).html;

    //restore our script and style tags as nodes to maintain validity with HTMLx
    for (const s of verbatimElements) {
        svelteHtmlxAst.children.push(s);
        svelteHtmlxAst.start = Math.min(svelteHtmlxAst.start, s.start);
        svelteHtmlxAst.end = Math.max(svelteHtmlxAst.end, s.end);
    }
    return svelteHtmlxAst;
}
