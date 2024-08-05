import { Node } from 'estree-walker';

function parseAttributes(str: string, start: number) {
    const attrs: Node[] = [];
    const pattern = /([\w-$]+\b)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

    let match: RegExpMatchArray;
    while ((match = pattern.exec(str)) !== null) {
        const attr = match[0];
        const name = match[1];
        const value = match[2] || match[3] || match[4];
        const attrStart = start + str.indexOf(attr);
        attrs[name] = value ?? name;
        attrs.push({
            type: 'Attribute',
            name,
            value: !value || [
                {
                    type: 'Text',
                    start: attrStart + attr.indexOf('=') + 1,
                    end: attrStart + attr.length,
                    raw: value
                }
            ],
            start: attrStart,
            end: attrStart + attr.length
        });
    }

    return attrs;
}

// Regex ensures that attributes with > characters in them still result in the content being matched correctly
const scriptRegex =
    /(<!--[^]*?-->)|(<script((?:\s+[^=>'"\/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"\/\s]+)*\s*)>)([\S\s]*?)<\/script>/g;
const styleRegex =
    /(<!--[^]*?-->)|(<style((?:\s+[^=>'"\/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"\/\s]+)*\s*)>)([\S\s]*?)<\/style>/g;

function extractTag(htmlx: string, tag: 'script' | 'style') {
    const exp = tag === 'script' ? scriptRegex : styleRegex;
    const matches: Node[] = [];

    let match: RegExpExecArray | null = null;
    while ((match = exp.exec(htmlx)) != null) {
        if (match[0].startsWith('<!--')) {
            // Tag is inside comment
            continue;
        }

        let content = match[4];
        if (!content) {
            // Keep tag and transform it like a regular element
            content = '';
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
    const styleTags = extractTag(htmlx, 'style');
    const tags = extractTag(htmlx, 'script');
    for (const styleTag of styleTags) {
        // Could happen if someone has a `<style>...</style>` string in their script tag
        const insideScript = tags.some(
            (tag) => tag.start < styleTag.start && tag.end > styleTag.end
        );
        if (!insideScript) {
            tags.push(styleTag);
        }
    }
    return tags;
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

export function parseHtmlx(
    htmlx: string,
    parse: typeof import('svelte/compiler').parse,
    options: { emitOnTemplateError?: boolean }
) {
    //Svelte tries to parse style and script tags which doesn't play well with typescript, so we blank them out.
    //HTMLx spec says they should just be retained after processing as is, so this is fine
    const verbatimElements = findVerbatimElements(htmlx);
    const deconstructed = blankVerbatimContent(htmlx, verbatimElements);

    //extract the html content parsed as htmlx this excludes our script and style tags
    const parsingCode = options.emitOnTemplateError
        ? blankPossiblyErrorOperatorOrPropertyAccess(deconstructed)
        : deconstructed;
    const htmlxAst = parse(parsingCode).html as any;

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

const id_char = /[\w$]/;

function blankPossiblyErrorOperatorOrPropertyAccess(htmlx: string) {
    let index = htmlx.indexOf('}');
    let lastIndex = 0;
    const { length } = htmlx;

    while (index < length && index >= 0) {
        let backwardIndex = index - 1;
        while (backwardIndex > lastIndex) {
            const char = htmlx.charAt(backwardIndex);
            if (possibleOperatorOrPropertyAccess.has(char)) {
                if (char === '!') {
                    // remove ! if it's at the beginning but not if it's used as the TS non-null assertion operator
                    let prev = backwardIndex - 1;
                    while (prev > lastIndex && htmlx.charAt(prev) === ' ') {
                        prev--;
                    }
                    if (id_char.test(htmlx.charAt(prev))) {
                        break;
                    }
                }
                const isPlusOrMinus = char === '+' || char === '-';
                const isIncrementOrDecrement =
                    isPlusOrMinus && htmlx.charAt(backwardIndex - 1) === char;

                if (isIncrementOrDecrement) {
                    backwardIndex -= 2;
                    continue;
                }
                htmlx =
                    htmlx.substring(0, backwardIndex) + ' ' + htmlx.substring(backwardIndex + 1);
            } else if (!/\s/.test(char) && char !== ')' && char !== ']') {
                break;
            }
            backwardIndex--;
        }

        lastIndex = index;
        index = htmlx.indexOf('}', index + 1);
    }

    return htmlx;
}
