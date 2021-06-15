import { parse } from 'svelte/compiler';
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
                        raw: parseAttributeValue(value)
                    }
                ],
                start: attrStart,
                end: attrStart + attr.length
            });
        });

    return attrs;
}

function extractTag(htmlx: string, tag: 'script' | 'style') {
    const exp = new RegExp(`(<!--[^]*?-->)|(<${tag}([\\S\\s]*?)>)([\\S\\s]*?)<\\/${tag}>`, 'g');
    const matches: Node[] = [];

    let match: RegExpExecArray | null = null;
    while ((match = exp.exec(htmlx)) != null) {
        if (match[0].startsWith('<!--')) {
            // Tag is inside comment
            continue;
        }

        const content = match[4];
        if (!content) {
            // Self-closing/empty tags don't need replacement
            continue;
        }

        const start = match.index + match[2].length;
        const end = start + content.length;
        const containerStart = match.index;
        const containerEnd = match.index + match[0].length;

        matches.push({
            start: containerStart,
            end: containerEnd,
            name: tag,
            type: tag === 'style' ? 'Style' : 'Script',
            attributes: parseAttributes(match[3], containerStart + `<${tag}`.length),
            content: {
                type: 'Text',
                start,
                end,
                value: content,
                raw: content
            }
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
                output
                    .substring(content.start, content.end)
                    // blank out the content
                    .replace(/[^\n]/g, ' ')
                    // excess blank space can make the svelte parser very slow (sec->min). break it up with comments (works in style/script)
                    .replace(/[^\n][^\n][^\n][^\n]\n/g, '/**/\n') +
                output.substring(content.end);
        }
    }
    return output;
}

export function parseHtmlx(htmlx: string, options?: { emitOnTemplateError?: boolean }) {
    //Svelte tries to parse style and script tags which doesn't play well with typescript, so we blank them out.
    //HTMLx spec says they should just be retained after processing as is, so this is fine
    const verbatimElements = findVerbatimElements(htmlx);
    const deconstructed = blankVerbatimContent(htmlx, verbatimElements);

    //extract the html content parsed as htmlx this excludes our script and style tags
    const parsingCode = options?.emitOnTemplateError
        ? blankPossiblyErrorOperatorOrPropertyAccess(deconstructed)
        : deconstructed;
    const htmlxAst = parse(parsingCode).html;

    //restore our script and style tags as nodes to maintain validity with HTMLx
    for (const s of verbatimElements) {
        htmlxAst.children.push(s);
        htmlxAst.start = Math.min(htmlxAst.start, s.start);
        htmlxAst.end = Math.max(htmlxAst.end, s.end);
    }
    return { htmlxAst, tags: verbatimElements };
}

const possibleOperatorOrPropertyAccess = new Set([
    '.',
    '?',
    '*',
    '~',
    '=',
    '<',
    '!',
    '&',
    '^',
    '|',
    ',',
    '+',
    '-'
]);

function blankPossiblyErrorOperatorOrPropertyAccess(htmlx: string) {
    let index = htmlx.indexOf('}');
    let lastIndex = 0;
    const { length } = htmlx;

    while (index < length && index >= 0) {
        let backwardIndex = index - 1;
        while (backwardIndex > lastIndex) {
            const char = htmlx.charAt(backwardIndex);
            if (possibleOperatorOrPropertyAccess.has(char)) {
                const isPlusOrMinus = char === '+' || char === '-';
                const isIncrementOrDecrement =
                    isPlusOrMinus && htmlx.charAt(backwardIndex - 1) === char;

                if (isIncrementOrDecrement) {
                    backwardIndex -= 2;
                    continue;
                }
                htmlx =
                    htmlx.substring(0, backwardIndex) + ' ' + htmlx.substring(backwardIndex + 1);
            } else if (!/\s/.test(char)) {
                break;
            }
            backwardIndex--;
        }

        lastIndex = index;
        index = htmlx.indexOf('}', index + 1);
    }

    return htmlx;
}
