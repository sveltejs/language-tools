import type ts from 'typescript/lib/tsserverlibrary';
import {
    isGeneratedSvelteComponentName,
    isNotNullOrUndefined,
    isSvelteFilePath,
    isNoTextSpanInGeneratedCode
} from '../utils';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { internalHelpers } from 'svelte2tsx';

export function decorateNavigateToItems(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager
): void {
    const getNavigateToItems = ls.getNavigateToItems;
    ls.getNavigateToItems = (...args) => {
        const navigationToItems = getNavigateToItems(...args);

        return navigationToItems
            .map((item) => {
                if (!isSvelteFilePath(item.fileName)) {
                    return item;
                }

                if (
                    item.name.startsWith('__sveltets_') ||
                    item.name === internalHelpers.renderName ||
                    item.name.startsWith('$$')
                ) {
                    return;
                }

                const snapshot = snapshotManager.get(item.fileName);
                if (!snapshot || !isNoTextSpanInGeneratedCode(snapshot.getText(), item.textSpan)) {
                    return;
                }

                let textSpan = snapshot.getOriginalTextSpan(item.textSpan);
                if (!textSpan) {
                    if (isGeneratedSvelteComponentName(item.name)) {
                        textSpan = { start: 0, length: 1 };
                    } else {
                        return;
                    }
                }

                const containerName =
                    item.containerName === internalHelpers.renderName || !item.containerName
                        ? isInScript(textSpan.start, snapshot.getOriginalText())
                            ? 'script'
                            : ''
                        : item.containerName;

                return {
                    ...item,
                    containerName,
                    textSpan
                };
            })
            .filter(isNotNullOrUndefined);
    };
}

function isInScript(offset: number, originalText: string): boolean {
    const text = originalText.slice(0, offset);
    const lastScriptTag = text.lastIndexOf('<script');
    const lastCloseTag = text.lastIndexOf('</script>');

    return lastScriptTag > lastCloseTag;
}
