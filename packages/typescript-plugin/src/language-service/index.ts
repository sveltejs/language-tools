import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isSvelteFilePath } from '../utils';
import { decorateCompletions } from './completions';
import { decorateGetDefinition } from './definition';
import { decorateDiagnostics } from './diagnostics';
import { decorateFindReferences } from './find-references';
import { decorateGetImplementation } from './implementation';
import { decorateRename } from './rename';

export function decorateLanguageService(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): ts.LanguageService {
    patchLineColumnOffset(ls, snapshotManager);
    decorateRename(ls, snapshotManager, logger);
    decorateDiagnostics(ls, logger);
    decorateFindReferences(ls, snapshotManager, logger);
    decorateCompletions(ls, logger);
    decorateGetDefinition(ls, snapshotManager, logger);
    decorateGetImplementation(ls, snapshotManager, logger);
    return ls;
}

function patchLineColumnOffset(ls: ts.LanguageService, snapshotManager: SvelteSnapshotManager) {
    if (!ls.toLineColumnOffset) {
        return;
    }

    // We need to patch this because (according to source, only) getDefinition uses this
    const toLineColumnOffset = ls.toLineColumnOffset;
    ls.toLineColumnOffset = (fileName, position) => {
        if (isSvelteFilePath(fileName)) {
            const snapshot = snapshotManager.get(fileName);
            if (snapshot) {
                return snapshot.positionAt(position);
            }
        }
        return toLineColumnOffset(fileName, position);
    };
}
