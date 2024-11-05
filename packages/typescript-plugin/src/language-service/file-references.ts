import type ts from 'typescript/lib/tsserverlibrary';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';
import { SvelteSnapshotManager } from '../svelte-snapshots';

export function decorateFileReferences(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager
): void {
    const getFileReferences = ls.getFileReferences;
    ls.getFileReferences = (fileName: string) => {
        const references = getFileReferences(fileName);

        return references
            .map((ref) => {
                if (!isSvelteFilePath(ref.fileName)) {
                    return ref;
                }

                let textSpan = snapshotManager.get(ref.fileName)?.getOriginalTextSpan(ref.textSpan);

                if (!textSpan) {
                    return;
                }

                return {
                    ...ref,
                    textSpan
                };
            })
            .filter(isNotNullOrUndefined);
    };
}
