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
        if (!renameLocations) {
            return undefined;
        }

        const convertedRenameLocations: ts.RenameLocation[] = [];
        const additionalStoreRenameLocations: ts.RenameLocation[] = [];

        for (const renameLocation of renameLocations) {
            const snapshot = snapshotManager.get(renameLocation.fileName);
            if (!isSvelteFilePath(renameLocation.fileName) || !snapshot) {
                convertedRenameLocations.push(renameLocation);
                continue;
            }

            // TODO more needed to filter invalid locations, see RenameProvider
            const textSpan = snapshot.getOriginalTextSpan(renameLocation.textSpan);
            if (!textSpan) {
                if (
                    additionalStoreRenameLocations &&
                    snapshot
                        .getText()
                        .lastIndexOf('__sveltets_1_store_get(', renameLocation.textSpan.start) ===
                        renameLocation.textSpan.start - '__sveltets_1_store_get('.length
                ) {
                    additionalStoreRenameLocations.push(
                        ...findRenameLocations(
                            renameLocation.fileName,
                            snapshot.getText().lastIndexOf(' =', renameLocation.textSpan.start) - 1,
                            false,
                            false,
                            false
                        )!
                    );
                }
                continue;
            }

            convertedRenameLocations.push(convert(renameLocation, textSpan));
        }

        for (const renameLocation of additionalStoreRenameLocations) {
            // We know these are Svelte files
            const snapshot = snapshotManager.get(renameLocation.fileName)!;

            const textSpan = snapshot.getOriginalTextSpan(renameLocation.textSpan);
            if (!textSpan) {
                continue;
            }

            // |$store| would be renamed, make it $|store|
            textSpan.start += 1;
            convertedRenameLocations.push(convert(renameLocation, textSpan));
        }

        return convertedRenameLocations;
    };

    function convert(renameLocation: ts.RenameLocation, textSpan: ts.TextSpan) {
        const converted = {
            ...renameLocation,
            textSpan
        };
        if (converted.contextSpan) {
            // Not important, spare the work
            converted.contextSpan = undefined;
        }
        logger.debug('Converted rename location ', converted);
        return converted;
    }
}
