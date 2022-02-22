import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { isSvelteFilePath, replaceDeep } from '../utils';

const componentPostfix = '__SvelteComponent_';

export function decorateCompletions(ls: ts.LanguageService, logger: Logger): void {
    const getCompletionsAtPosition = ls.getCompletionsAtPosition;
    ls.getCompletionsAtPosition = (fileName, position, options) => {
        const completions = getCompletionsAtPosition(fileName, position, options);
        if (!completions) {
            return completions;
        }
        return {
            ...completions,
            entries: completions.entries.map((entry) => {
                if (
                    !isSvelteFilePath(entry.source || '') ||
                    !entry.name.endsWith(componentPostfix)
                ) {
                    return entry;
                }
                return {
                    ...entry,
                    name: entry.name.slice(0, -componentPostfix.length)
                };
            })
        };
    };

    const getCompletionEntryDetails = ls.getCompletionEntryDetails;
    ls.getCompletionEntryDetails = (
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        data
    ) => {
        const details = getCompletionEntryDetails(
            fileName,
            position,
            entryName,
            formatOptions,
            source,
            preferences,
            data
        );
        if (details || !isSvelteFilePath(source || '')) {
            return details;
        }

        // In the completion list we removed the component postfix. Internally,
        // the language service saved the list with the postfix, so details
        // won't match anything. Therefore add it back and remove it afterwards again.
        const svelteDetails = getCompletionEntryDetails(
            fileName,
            position,
            entryName + componentPostfix,
            formatOptions,
            source,
            preferences,
            data
        );
        if (!svelteDetails) {
            return undefined;
        }
        logger.debug('Found Svelte Component import completion details');

        return replaceDeep(svelteDetails, componentPostfix, '');
    };
}
