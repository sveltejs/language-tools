import path from 'path';
import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isSvelteFilePath } from '../utils';

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
        return renameLocations
            ?.filter((renameLocation) => {
                // If a file move/rename of a TS/JS file results a Svelte file change,
                // the Svelte extension will notice that, too, and adjusts the same imports.
                // This results in duplicate adjustments or race conditions with conflicting text spans
                // which can break imports in some cases.
                // Therefore don't do any updates of Svelte files and and also no updates of mixed TS files
                // and let the Svelte extension handle that.
                return (
                    !isSvelteFilePath(renameLocation.fileName) &&
                    !renameLocation.textChanges.some((change) => change.newText.endsWith('.svelte'))
                );
            })
            .map((renameLocation) => {
                if (path.basename(renameLocation.fileName).startsWith('+')) {
                    // Filter out changes to './$type' imports for Kit route files,
                    // you'll likely want these to stay as-is
                    renameLocation.textChanges = renameLocation.textChanges.filter((change) => {
                        return !change.newText.includes('.svelte-kit/types/');
                    });
                }
                return renameLocation;
            });
    };
}
