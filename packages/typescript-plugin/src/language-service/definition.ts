import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';

export function decorateGetDefinition(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): void {
    const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan;
    ls.getDefinitionAndBoundSpan = (fileName, position) => {
        const definition = getDefinitionAndBoundSpan(fileName, position);
        if (!definition || !definition.definitions) {
            return definition;
        }

        return {
            ...definition,
            definitions: definition.definitions
                .map((def) => {
                    if (!isSvelteFilePath(def.fileName)) {
                        return def;
                    }

                    const textSpan = snapshotManager
                        .get(def.fileName)
                        ?.getOriginalTextSpan(def.textSpan);
                    if (!textSpan) {
                        return undefined;
                    }
                    return {
                        ...def,
                        textSpan,
                        // Spare the work for now
                        originalTextSpan: undefined,
                        contextSpan: undefined,
                        originalContextSpan: undefined
                    };
                })
                .filter(isNotNullOrUndefined)
        };
    };
}
