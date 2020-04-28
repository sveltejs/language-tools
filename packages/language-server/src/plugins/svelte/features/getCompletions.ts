import { SvelteDocument } from '../SvelteDocument';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
} from 'vscode-languageserver';

type SvelteTag = 'each' | 'if' | 'await' | 'html' | 'debug';

/**
 * Get completions for special svelte tags within moustache tags.
 */
export function getCompletions(
    svelteDoc: SvelteDocument,
    position: Position,
): CompletionList | null {
    const offset = svelteDoc.offsetAt(position);

    const isInStyleOrScript =
        svelteDoc.style.isInFragment(position) || svelteDoc.script.isInFragment(position);
    const lastCharactersBeforePosition = svelteDoc
        .getText()
        // use last 10 characters, should cover 99% of all cases
        .substr(Math.max(offset - 10, 0), Math.min(offset, 10));
    const notPreceededByOpeningBracket = !/[\s\S]*{\s*[#:/@]\w*$/.test(
        lastCharactersBeforePosition,
    );
    if (isInStyleOrScript || notPreceededByOpeningBracket) {
        return null;
    }

    const triggerCharacter = getTriggerCharacter(lastCharactersBeforePosition);
    // return all, filtering with regards to user input will be done client side
    return getCompletionsWithRegardToTriggerCharacter(triggerCharacter, svelteDoc, offset);
}

/**
 * Get completions with regard to trigger character.
 */
function getCompletionsWithRegardToTriggerCharacter(
    triggerCharacter: string,
    svelteDoc: SvelteDocument,
    offset: number,
) {
    if (triggerCharacter === '@') {
        return createCompletionItems([
            { tag: 'html', label: 'html' },
            { tag: 'debug', label: 'debug' },
        ]);
    }

    if (triggerCharacter === '#') {
        return createCompletionItems([
            { tag: 'if', label: 'if' },
            { tag: 'each', label: 'each' },
            { tag: 'await', label: 'await' },
        ]);
    }

    if (triggerCharacter === ':') {
        return showCompletionWithRegardsToOpenedTags(
            {
                awaitOpen: createCompletionItems([
                    { tag: 'await', label: 'then' },
                    { tag: 'await', label: 'catch' },
                ]),
                eachOpen: createCompletionItems([{ tag: 'each', label: 'else' }]),
                ifOpen: createCompletionItems([
                    { tag: 'if', label: 'else' },
                    { tag: 'if', label: 'else if' },
                ]),
            },
            svelteDoc,
            offset,
        );
    }

    if (triggerCharacter === '/') {
        return showCompletionWithRegardsToOpenedTags(
            {
                awaitOpen: createCompletionItems([{ tag: 'await', label: 'await' }]),
                eachOpen: createCompletionItems([{ tag: 'each', label: 'each' }]),
                ifOpen: createCompletionItems([{ tag: 'if', label: 'if' }]),
            },
            svelteDoc,
            offset,
        );
    }

    return null;
}

/**
 * Get trigger character in front of current position.
 */
function getTriggerCharacter(content: string) {
    const chars = [
        getLastIndexOf('#'),
        getLastIndexOf('/'),
        getLastIndexOf(':'),
        getLastIndexOf('@'),
    ];
    return chars.sort((c1, c2) => c2.idx - c1.idx)[0].char;

    function getLastIndexOf(char: '#' | '/' | ':' | '@') {
        return { char, idx: content.lastIndexOf(char) };
    }
}

/**
 * Return completions with regards to last opened tag.
 */
function showCompletionWithRegardsToOpenedTags(
    on: { eachOpen: CompletionList; ifOpen: CompletionList; awaitOpen: CompletionList },
    svelteDoc: SvelteDocument,
    offset: number,
) {
    switch (getLatestOpeningTag(svelteDoc, offset)) {
        case 'each':
            return on.eachOpen;
        case 'if':
            return on.ifOpen;
        case 'await':
            return on.awaitOpen;
        default:
            return null;
    }
}

/**
 * Get the last tag that is opened but not closed.
 */
function getLatestOpeningTag(svelteDoc: SvelteDocument, offset: number) {
    // Only use content up to the position and strip out html comments
    const content = svelteDoc
        .getText()
        .substring(0, offset)
        .replace(/<!--(.*?)-->/g, '');
    const lastIdxs = [
        idxOfLastOpeningTag(content, 'each'),
        idxOfLastOpeningTag(content, 'if'),
        idxOfLastOpeningTag(content, 'await'),
    ];
    const lastIdx = lastIdxs.sort((i1, i2) => i2.lastIdx - i1.lastIdx);
    return lastIdx[0].lastIdx === -1 ? null : lastIdx[0].tag;
}

/**
 * Get the last tag and its index that is opened but not closed.
 */
function idxOfLastOpeningTag(content: string, tag: SvelteTag) {
    const nrOfEndingTags = content.match(new RegExp(`{\s*/${tag}`, 'g'))?.length ?? 0;

    let lastIdx = -1;
    let nrOfOpeningTags = 0;
    let match: RegExpExecArray | null;
    const regexp = new RegExp(`{\s*#${tag}`, 'g');
    while ((match = regexp.exec(content)) != null) {
        nrOfOpeningTags += 1;
        lastIdx = match.index;
    }

    return { lastIdx: nrOfOpeningTags <= nrOfEndingTags ? -1 : lastIdx, tag };
}

/**
 * Create the completion items for given labels and tags.
 */
function createCompletionItems(items: { label: string; tag: SvelteTag }[]): CompletionList {
    return CompletionList.create(
        // add sortText/preselect so it is ranked higher than other completions and selected first
        items.map(
            item =>
                <CompletionItem>{
                    label: item.label,
                    sortText: '-1',
                    kind: CompletionItemKind.Keyword,
                    preselect: true,
                    documentation: {
                        kind: 'markdown',
                        value: documentation[item.tag],
                    },
                },
        ),
    );
}

/**
 * For each tag, a documentation in markdown format.
 */
const documentation = {
    await: `\`{#await ...}\`\\
Await blocks allow you to branch on the three possible states of a Promise — pending, fulfilled or rejected.
#### Usage:
\`{#await expression}...{:then name}...{:catch name}...{/await}\`\\
\`{#await expression}...{:then name}...{/await}\`\\
\`{#await expression then name}...{/await}\`
`,
    each: `\`{#each ...}\`\\
Iterating over lists of values can be done with an each block.
#### Usage:
\`{#each expression as name}...{/each}\`\\
\`{#each expression as name, index}...{/each}\`\\
\`{#each expression as name, index (key)}...{/each}\`\\
\`{#each expression as name}...{:else}...{/each}\`
`,
    if: `\`{#if ...}\`\\
Content that is conditionally rendered can be wrapped in an if block.
#### Usage:
\`{#if expression}...{/if}\`\\
\`{#if expression}...{:else if expression}...{/if}\`\\
\`{#if expression}...{:else}...{/if}\`
`,
    html: `\`{@html ...}\`\\
In a text expression, characters like < and > are escaped; however, with HTML expressions, they're not.
The expression should be valid standalone HTML.
#### Caution
Svelte does not sanitize expressions before injecting HTML.
If the data comes from an untrusted source, you must sanitize it, or you are exposing your users to an XSS vulnerability.
#### Usage:
\`{@html expression}\`
`,
    debug: `\`{@debug ...}\`\\
Offers an alternative to \`console.log(...)\`.
It logs the values of specific variables whenever they change, and pauses code execution if you have devtools open.
It accepts a comma-separated list of variable names (not arbitrary expressions).
#### Usage:
\`{@debug\`}
\`{@debug var1, var2, ..., varN}\`
`,
};
