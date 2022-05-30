import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import {
    get$storeDeclarationStart,
    isInsideStoreGetShim,
    isNotNullOrUndefined,
    isSvelteFilePath
} from '../utils';

export function decorateFindReferences(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): void {
    decorateGetReferencesAtPosition(ls, snapshotManager, logger);
    _decorateFindReferences(ls, snapshotManager, logger);
}

function _decorateFindReferences(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
) {
    const findReferences = ls.findReferences;

    const getReferences = (fileName: string, position: number): ts.ReferenceEntry[] | undefined =>
        findReferences(fileName, position)?.reduce(
            (acc, curr) => acc.concat(curr.references),
            <ts.ReferenceEntry[]>[]
        );

    ls.findReferences = (fileName, position) => {
        const references = findReferences(fileName, position);
        return references
            ?.map((reference) => {
                const snapshot = snapshotManager.get(reference.definition.fileName);
                if (!isSvelteFilePath(reference.definition.fileName) || !snapshot) {
                    return {
                        ...reference,
                        references: mapReferences(
                            reference.references,
                            snapshotManager,
                            logger,
                            getReferences
                        )
                    };
                }

                const textSpan = snapshot.getOriginalTextSpan(reference.definition.textSpan);
                if (!textSpan) {
                    return null;
                }
                return {
                    definition: {
                        ...reference.definition,
                        textSpan,
                        // Spare the work for now
                        originalTextSpan: undefined
                    },
                    references: mapReferences(
                        reference.references,
                        snapshotManager,
                        logger,
                        getReferences
                    )
                };
            })
            .filter(isNotNullOrUndefined);
    };
}

function decorateGetReferencesAtPosition(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
) {
    const getReferencesAtPosition = ls.getReferencesAtPosition;
    ls.getReferencesAtPosition = (fileName, position) => {
        const references = getReferencesAtPosition(fileName, position);
        return (
            references &&
            mapReferences(references, snapshotManager, logger, getReferencesAtPosition)
        );
    };
}

function mapReferences(
    references: ts.ReferenceEntry[],
    snapshotManager: SvelteSnapshotManager,
    logger: Logger,
    getReferences?: (fileName: string, position: number) => ts.ReferenceEntry[] | undefined
): ts.ReferenceEntry[] {
    const additionalStoreReferences: ts.ReferenceEntry[] = [];
    const mappedReferences: ts.ReferenceEntry[] = [];

    for (const reference of references) {
        const snapshot = snapshotManager.get(reference.fileName);
        if (!isSvelteFilePath(reference.fileName) || !snapshot) {
            mappedReferences.push(reference);
            continue;
        }

        const textSpan = snapshot.getOriginalTextSpan(reference.textSpan);
        if (!textSpan) {
            if (
                getReferences &&
                isInsideStoreGetShim(snapshot.getText(), reference.textSpan.start)
            ) {
                additionalStoreReferences.push(
                    ...(getReferences(
                        reference.fileName,
                        get$storeDeclarationStart(snapshot.getText(), reference.textSpan.start)
                    ) || [])
                );
            }
            continue;
        }

        mappedReferences.push(mapReference(reference, textSpan));
    }

    for (const reference of additionalStoreReferences) {
        // We know these are Svelte files
        const snapshot = snapshotManager.get(reference.fileName)!;

        const textSpan = snapshot.getOriginalTextSpan(reference.textSpan);
        if (!textSpan) {
            continue;
        }

        mappedReferences.push(mapReference(reference, textSpan));
    }

    return mappedReferences;

    function mapReference(reference: ts.ReferenceEntry, textSpan: ts.TextSpan) {
        logger.debug('Find references; map textSpan: changed', reference.textSpan, 'to', textSpan);

        return {
            ...reference,
            textSpan,
            // Spare the work for now
            contextSpan: undefined,
            originalTextSpan: undefined,
            originalContextSpan: undefined
        };
    }
}
