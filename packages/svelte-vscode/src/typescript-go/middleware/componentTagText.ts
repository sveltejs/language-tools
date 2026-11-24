// Text-only helpers for completions at a component tag name in the template (`<|`, `<Chi|`).
// No vscode dependency, so they are unit-testable.
// The script query offset only exists for the TS7 workarounds in `transformCompletions`
// (`<` trigger rejected, no auto-imports in the template); remove it with them.

export interface TagNameContext {
    /** What has been typed after `<` so far (may be empty) */
    word: string;
    /**
     * Offset in the instance script (or else the module script) where TS7 sees all top-level
     * bindings of the component, see `getScriptQueryOffset`. Undefined if the file has no script.
     */
    scriptQueryOffset: number | undefined;
    /** Text of that script block (cache key for the completions there) */
    scriptText: string | undefined;
}

export interface Block {
    start: number;
    end: number;
    tag: 'script' | 'style';
    attributes: string;
    contentStart: number;
    contentEnd: number;
}

const blockRegex = /<(script|style)(\s[^>]*)?>([\s\S]*?)(<\/\1\s*>|$)/g;

export function findBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    for (const match of text.matchAll(blockRegex)) {
        const start = match.index!;
        const contentStart = start + match[0].length - match[3].length - match[4].length;
        blocks.push({
            start,
            end: start + match[0].length,
            tag: match[1] as Block['tag'],
            attributes: match[2] ?? '',
            contentStart,
            contentEnd: contentStart + match[3].length
        });
    }
    return blocks;
}

const moduleScriptRegex = /\bcontext\s*=\s*["']?module\b|(^|\s)module(\s|=|$)/;

export function isModuleScript(block: Block) {
    return moduleScriptRegex.test(block.attributes);
}

/**
 * Returns the context if `offset` is at the name of a start tag in the template, i.e. after `<` or
 * `<Name` in markup, and not inside script/style, a `{...}` expression or an HTML comment.
 * Dotted names (`<ui.Button`) are member completions and return undefined.
 */
export function getTagNameContext(text: string, offset: number): TagNameContext | undefined {
    const match = /<([A-Za-z_$][\w$]*)?$/.exec(text.slice(Math.max(0, offset - 200), offset));
    if (!match) {
        return undefined;
    }
    const tagStart = offset - match[0].length;
    const blocks = findBlocks(text);
    if (blocks.some((block) => tagStart >= block.start && tagStart < block.end)) {
        return undefined;
    }
    if (isInExpressionOrComment(text, tagStart, blocks)) {
        return undefined;
    }

    const scripts = blocks.filter((block) => block.tag === 'script');
    const script = scripts.find((block) => !isModuleScript(block)) ?? scripts[0];
    return {
        word: match[1] ?? '',
        scriptQueryOffset: script && getScriptQueryOffset(text, script),
        scriptText: script && text.slice(script.start, script.end)
    };
}

/**
 * Right after `<script ...>` if the content starts with a line break (the usual formatting), else
 * the end of the content.
 * The start is preferred because TS7 only offers auto-imports if the position maps exactly to the
 * virtual code.
 */
function getScriptQueryOffset(text: string, script: Block) {
    return /^[ \t]*\r?\n/.test(text.slice(script.contentStart, script.contentEnd))
        ? script.contentStart
        : script.contentEnd;
}

/** Scans the markup up to `offset`, skipping script/style blocks */
function isInExpressionOrComment(text: string, offset: number, blocks: Block[]): boolean {
    let depth = 0;
    let i = 0;
    while (i < offset) {
        const block = blocks.find((b) => b.start === i);
        if (block) {
            i = block.end;
            continue;
        }
        if (depth === 0 && text.startsWith('<!--', i)) {
            const end = text.indexOf('-->', i + 4);
            if (end === -1 || end + 3 > offset) {
                return true;
            }
            i = end + 3;
            continue;
        }
        const char = text[i];
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth = Math.max(0, depth - 1);
        } else if (depth > 0 && (char === '"' || char === "'" || char === '`')) {
            // skip JS strings inside expressions, they may contain braces
            let j = i + 1;
            while (j < offset && text[j] !== char) {
                j += text[j] === '\\' ? 2 : 1;
            }
            if (j >= offset) {
                return true;
            }
            i = j;
        }
        i++;
    }
    return depth > 0;
}

const startsWithUppercase = /^[A-Z]/;

/**
 * Whether a TS7 completion item can be a component tag name. Same rule as the TS6
 * `CompletionProvider` for start tags in broken templates: components start with an uppercase
 * letter (lowercase names are HTML elements, which the Svelte language server completes).
 */
export function isComponentTagCandidate(label: string): boolean {
    return startsWithUppercase.test(label);
}

/** TS sort text of globals and keywords (`SortText.GlobalsOrKeywords`) */
export const globalsSortText = '15';
