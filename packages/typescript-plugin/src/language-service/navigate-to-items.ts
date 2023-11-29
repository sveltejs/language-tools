import type ts from 'typescript/lib/tsserverlibrary';
import { isGeneratedSvelteComponentName, isNotNullOrUndefined, isSvelteFilePath } from '../utils';
import { SvelteSnapshotManager } from '../svelte-snapshots';

export function decorateNavigateToItems(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager
): void {
    const getNavigateToItems = ls.getNavigateToItems;
    ls.getNavigateToItems = (
        searchValue: string,
        maxResultCount?: number,
        fileName?: string,
        excludeDtsFiles?: boolean
    ) => {
        const navigationToItems = getNavigateToItems(
            searchValue,
            maxResultCount,
            fileName,
            excludeDtsFiles
        );

        return navigationToItems
            .map((item) => {
                if (!isSvelteFilePath(item.fileName)) {
                    return item;
                }

                if (
                    item.name.startsWith('__sveltets_') ||
                    (item.name === 'render' && !item.containerName)
                ) {
                    return;
                }

                let textSpan = snapshotManager
                    .get(item.fileName)
                    ?.getOriginalTextSpan(item.textSpan);

                if (!textSpan) {
                    if (isGeneratedSvelteComponentName(item.name)) {
                        textSpan = { start: 0, length: 1 };
                    } else {
                        return;
                    }
                }

                return {
                    ...item,
                    textSpan
                };
            })
            .filter(isNotNullOrUndefined);
    };
}
