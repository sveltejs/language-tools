import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';

export function decorateUpdateImports(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): void {
    const getEditsForFileRename = ls.getEditsForFileRename;
    ls.getEditsForFileRename = (oldFilePath, newFilePath, formatOptions, preferences) => {
        const renameLocations = getEditsForFileRename(
            oldFilePath,
            newFilePath,
            formatOptions,
            preferences
        );
        // If a file move/rename of a TS/JS file results a Svelte file change,
        // the Svelte extension will notice that, too, and adjusts the same imports.
        // This results in duplicate adjustments which can break imports in some cases.
        // Therefore don't do any updates in this case and let the Svelte extension handle that.
        const containsSvelteFile = renameLocations?.some((renameLocation) => {
            return isSvelteFilePath(renameLocation.fileName);
        });
        if (containsSvelteFile) {
            logger.debug(
                'File rename also touched Svelte file -> let Svelte extension handle that'
            );
            return [];
        }
        return renameLocations;
    };
}
