import { SvelteDocument } from '../SvelteDocument';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
} from 'vscode-languageserver';
import { SvelteTag, documentation, getLatestOpeningTag } from './SvelteTags';
import { isInTag } from '../../../lib/documents';

/**
 * Get completions for special svelte tags within moustache tags.
 */
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
 * Create the completion items for given labels and tags.
 */
function createCompletionItems(items: { label: string; tag: SvelteTag }[]): CompletionList {
    return CompletionList.create(
        // add sortText/preselect so it is ranked higher than other completions and selected first
        items.map(
            (item) =>
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
