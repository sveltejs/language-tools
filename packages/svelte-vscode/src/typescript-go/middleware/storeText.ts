/**
 * Text heuristics for `$store` handling in content mapper mode.
 *
 * svelte2tsx emits one hidden `let $store = __sveltets_2_store_get(store);` per file. That line isn't
 * mapped, so TS7 sees `store` and `$store` as unrelated variables. These helpers find the two sides
 * in the original text; TS7 still does the actual semantic work (rename, references, definition).
 *
 * Heuristic, not semantic: the binding lookup relies on Svelte's rule that stores used with `$` must be
 * declared or imported at the top level of the component. A precise version would ask the TS7 API
 * for the argument of the hidden `__sveltets_2_store_get(store)` call instead.
 */

/** `$foo` identifiers that are runes, not store subscriptions */
const runes = new Set(['state', 'derived', 'props', 'effect', 'bindable', 'inspect', 'host']);

const identifierChar = /[\w$]/;
const identifierRegex = /^[A-Za-z_][\w$]*$/;

export interface StoreAccess {
    /** Name of the store (without `$`) */
    name: string;
    /** Offset of the `$` */
    start: number;
    end: number;
}

/**
 * Returns the `$store` access at `offset`, if there is one.
 * Excludes `$$props` & co, runes and property accesses (`obj.$foo`).
 */
export function getStoreAccessAt(text: string, offset: number): StoreAccess | undefined {
    let start = offset;
    let end = offset;
    while (start > 0 && identifierChar.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && identifierChar.test(text[end])) {
        end++;
    }
    const token = text.slice(start, end);
    if (!token.startsWith('$') || token.startsWith('$$') || text[start - 1] === '.') {
        return;
    }
    const name = token.slice(1);
    if (!identifierRegex.test(name) || runes.has(name)) {
        return;
    }
    return { name, start, end };
}

/** Returns the identifier at `offset` (plain identifiers only, not `$`-prefixed ones) */
export function getIdentifierAt(text: string, offset: number): string | undefined {
    let start = offset;
    let end = offset;
    while (start > 0 && identifierChar.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && identifierChar.test(text[end])) {
        end++;
    }
    const token = text.slice(start, end);
    return identifierRegex.test(token) ? token : undefined;
}

/**
 * Offsets of all `$name` occurrences outside of comments. May include occurrences in strings or in
 * unrelated scopes; callers validate them with TS7 (references).
 */
export function findStoreUsageOffsets(text: string, name: string): number[] {
    const searchable = blankComments(text);
    const needle = '$' + name;
    const offsets: number[] = [];
    let index = searchable.indexOf(needle);
    while (index !== -1) {
        const before = searchable[index - 1];
        const after = searchable[index + needle.length];
        if (
            (before === undefined || !/[\w$.]/.test(before)) &&
            (after === undefined || !identifierChar.test(after))
        ) {
            offsets.push(index);
        }
        index = searchable.indexOf(needle, index + needle.length);
    }
    return offsets;
}

/**
 * Offset of the top-level binding of `name` in the `<script>` tags of a Svelte file:
 * `const|let|var name`, a default/named/namespace import, `export let name`.
 */
export function findStoreBindingOffset(text: string, name: string): number | undefined {
    const escaped = name.replace(/\$/g, '\\$');
    const patterns = [
        new RegExp(`\\b(?:const|let|var)\\s+(${escaped})\\b`, 'g'),
        new RegExp(`\\bimport\\s+(?:type\\s+)?(${escaped})\\s*(?:,|\\bfrom\\b)`, 'g'),
        new RegExp(`\\bimport\\s*\\*\\s*as\\s+(${escaped})\\b`, 'g')
    ];

    for (const script of getScriptContents(text)) {
        const content = blankComments(script.content);

        for (const pattern of patterns) {
            const match = pattern.exec(content);
            if (match) {
                return script.start + match.index + match[0].lastIndexOf(match[1]);
            }
        }

        // import { a, b as name } from '...'
        const namedImports = /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}/g;
        let match: RegExpExecArray | null;
        while ((match = namedImports.exec(content))) {
            const listStart = match.index + match[0].indexOf('{') + 1;
            let specifierStart = listStart;
            for (const specifier of match[1].split(',')) {
                const local = specifier
                    .trim()
                    .split(/\s+as\s+/)
                    .pop()
                    ?.replace(/^type\s+/, '');
                if (local === name) {
                    const offsetInSpecifier = specifier.lastIndexOf(name);
                    return script.start + specifierStart + offsetInSpecifier;
                }
                specifierStart += specifier.length + 1;
            }
        }
    }
    return undefined;
}

const scriptRegex = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;

function getScriptContents(text: string): Array<{ start: number; content: string }> {
    const result: Array<{ start: number; content: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(text))) {
        result.push({
            start: match.index + match[0].indexOf('>') + 1,
            content: match[2]
        });
    }
    return result;
}

/** Replaces comments with spaces, keeping offsets intact */
function blankComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->/g, (comment) =>
        comment.replace(/[^\n]/g, ' ')
    );
}
