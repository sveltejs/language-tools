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

function toVerbatimNode(match: RegExpExecArray, tag: 'script' | 'style'): Node {
    let content = match[4];
    if (!content) {
        // Keep tag and transform it like a regular element
        content = '';
    }

    const start = match.index + match[2].length;
    const end = start + content.length;
    const containerStart = match.index;
    const containerEnd = match.index + match[0].length;

    return {
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
    };
}

/**
 * Find the next real script or style element at or after `from`.
 *
 * Both tags are searched in the same pass and the earlier match wins, so a
 * literal `<script>` or `<style>` substring inside the *other* kind of tag
 * (for example in a comment or a string) can never be mistaken for a real
 * start tag: whichever element actually opens first is matched first, and the
 * search then resumes past its end.
 */
function findNextVerbatimElement(htmlx: string, from: number) {
    let best: { node: Node; nextIndex: number } | null = null;

    for (const [tag, exp] of [
        ['script', scriptRegex],
        ['style', styleRegex]
    ] as const) {
        exp.lastIndex = from;

        let match: RegExpExecArray | null = null;
        while ((match = exp.exec(htmlx)) != null) {
            if (match[0].startsWith('<!--')) {
                // Tag is inside comment
                continue;
            }

            if (!best || match.index < best.node.start) {
                best = { node: toVerbatimNode(match, tag), nextIndex: exp.lastIndex };
            }
            break;
        }
    }

    return best;
}

function findVerbatimElements(htmlx: string) {
    const tags: Node[] = [];

    let from = 0;
    let next: ReturnType<typeof findNextVerbatimElement>;
    while ((next = findNextVerbatimElement(htmlx, from)) != null) {
        tags.push(next.node);
        from = next.nextIndex;
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
    options: { emitOnTemplateError?: boolean; svelte5Plus: boolean }
) {
    //Svelte tries to parse style and script tags which doesn't play well with typescript, so we blank them out.
    //HTMLx spec says they should just be retained after processing as is, so this is fine
    const verbatimElements = findVerbatimElements(htmlx);
    const deconstructed = blankVerbatimContent(htmlx, verbatimElements);

    //extract the html content parsed as htmlx this excludes our script and style tags
    const parsingCode =
        options.emitOnTemplateError && !options.svelte5Plus
            ? blankPossiblyErrorOperatorOrPropertyAccess(deconstructed)
            : deconstructed;
    const parsed = parse(
        parsingCode,
        options.svelte5Plus ? ({ loose: options.emitOnTemplateError } as any) : undefined
    ) as any;
    const htmlxAst = parsed.html;

    htmlxAst._comments = parsed._comments ?? parsed.comments ?? [];

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
