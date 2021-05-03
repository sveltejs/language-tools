import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';

export function decorateRename(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): void {
    const findRenameLocations = ls.findRenameLocations;
    ls.findRenameLocations = (
        fileName,
        position,
        findInStrings,
        findInComments,
        providePrefixAndSuffixTextForRename
    ) => {
        const renameLocations = findRenameLocations(
            fileName,
            position,
            findInStrings,
            findInComments,
            providePrefixAndSuffixTextForRename
        );
        return renameLocations
            ?.map((renameLocation) => {
                const snapshot = snapshotManager.get(renameLocation.fileName);
                if (!isSvelteFilePath(renameLocation.fileName) || !snapshot) {
                    return renameLocation;
                }

                // TODO more needed to filter invalid locations, see RenameProvider
                const start = snapshot.getOriginalOffset(renameLocation.textSpan.start);
                if (start === -1) {
                    return null;
                }

                const converted = {
                    ...renameLocation,
                    textSpan: {
                        start: start,
                        length: renameLocation.textSpan.length
                    }
                };
                if (converted.contextSpan) {
                    // Not important, spare the work
                    converted.contextSpan = undefined;
                }
                logger.debug('Converted rename location ', converted);
                return converted;
            })
            .filter(isNotNullOrUndefined);
    };
}
