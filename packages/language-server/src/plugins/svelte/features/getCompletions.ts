import { EOL } from 'os';
import { SvelteDocument } from '../SvelteDocument';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
    InsertTextFormat,
} from 'vscode-languageserver';
import { SvelteTag, documentation, getLatestOpeningTag } from './SvelteTags';
import { isInTag } from '../../../lib/documents';

const HTML_COMMENT_START = '<!--';

const componentDocumentationCompletion: CompletionItem = {
    label: '@component',
    insertText: `component${EOL}$1${EOL}`,
    documentation:
        'Documentation for this component. ' +
        'It will show up on hover. You can use markdown and code blocks here',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Snippet,
    sortText: '-1',
    filterText: 'component',
    preselect: true,
};

export function getCompletions(
    svelteDoc: SvelteDocument,
    position: Position,
): CompletionList | null {
    const offset = svelteDoc.offsetAt(position);

    const isInStyleOrScript =
        isInTag(position, svelteDoc.style) ||
        isInTag(position, svelteDoc.script) ||
        isInTag(position, svelteDoc.moduleScript);
    const lastCharactersBeforePosition = svelteDoc
        .getText()
        // use last 10 characters, should cover 99% of all cases
        .substr(Math.max(offset - 10, 0), Math.min(offset, 10));
    const notPreceededByOpeningBracket = !/[\s\S]*{\s*[#:/@]\w*$/.test(
        lastCharactersBeforePosition,
    );
    if (isInStyleOrScript) {
        return null;
    }

    if (notPreceededByOpeningBracket) {
        return getComponentDocumentationCompletions();
    }

    return getTagCompletionsWithinMoustache();

    /**
     * Get completions for special svelte tags within moustache tags.
     */
    function getTagCompletionsWithinMoustache() {
        const triggerCharacter = getTriggerCharacter(lastCharactersBeforePosition);
        // return all, filtering with regards to user input will be done client side
        return getCompletionsWithRegardToTriggerCharacter(triggerCharacter, svelteDoc, offset);
    }

    function getComponentDocumentationCompletions() {
        if (!lastCharactersBeforePosition.includes(HTML_COMMENT_START)) {
            return null;
        }

        const commentStartIndex = lastCharactersBeforePosition.lastIndexOf(HTML_COMMENT_START);
        const text = lastCharactersBeforePosition
            .substring(commentStartIndex + HTML_COMMENT_START.length)
            .trimLeft();

        if (componentDocumentationCompletion.label.includes(text)) {
            return CompletionList.create([componentDocumentationCompletion], false);
        }
        return null;
    }
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
            { tag: 'if', label: 'if', insertText: 'if $1}\n\t$2\n{/if' },
            { tag: 'each', label: 'each', insertText: 'each $1 as $2}\n\t$3\n{/each' },
            {
                tag: 'await',
                label: 'await :then',
                insertText: 'await $1}\n\t$2\n{:then $3} \n\t$4\n{/await',
            },
            {
                tag: 'await',
                label: 'await then',
                insertText: 'await $1 then $2}\n\t$3\n{/await',
            },
            { tag: 'key', label: 'key', insertText: 'key $1}\n\t$2\n{/key' },
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
                keyOpen: createCompletionItems([{ tag: 'key', label: 'key' }]),
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
    on: {
        eachOpen: CompletionList;
        ifOpen: CompletionList;
        awaitOpen: CompletionList;
        keyOpen?: CompletionList;
    },
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
        case 'key':
            return on?.keyOpen ?? null;
        default:
            return null;
    }
}

/**
 * Create the completion items for given labels and tags.
 */
function createCompletionItems(
    items: { label: string; tag: SvelteTag; insertText?: string }[],
): CompletionList {
    return CompletionList.create(
        // add sortText/preselect so it is ranked higher than other completions and selected first
        items.map(
            (item) =>
                <CompletionItem>{
                    insertTextFormat: InsertTextFormat.Snippet,
                    insertText: item.insertText,
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
