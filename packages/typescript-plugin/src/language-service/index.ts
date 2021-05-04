import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { decorateCompletions } from './completions';
import { decorateDiagnostics } from './diagnostics';
import { decorateFindReferences } from './find-references';
import { decorateRename } from './rename';

export function decorateLanguageService(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): ts.LanguageService {
    decorateRename(ls, snapshotManager, logger);
    decorateDiagnostics(ls, logger);
    decorateFindReferences(ls, snapshotManager, logger);
    decorateCompletions(ls, logger);
    return ls;
}
