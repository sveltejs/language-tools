import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import {
    get$storeOffsetOf$storeDeclaration,
    isStoreVariableIn$storeDeclaration,
    isSvelteFilePath
} from '../utils';

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
            // @ts-expect-error overload shenanigans
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
                    isStoreVariableIn$storeDeclaration(
                        snapshot.getText(),
                        renameLocation.textSpan.start
                    )
                ) {
                    additionalStoreRenameLocations.push(
                        ...findRenameLocations(
                            renameLocation.fileName,
                            get$storeOffsetOf$storeDeclaration(
                                snapshot.getText(),
                                renameLocation.textSpan.start
                            ),
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
            textSpan.length -= 1;
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
