import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager } from '../config-manager';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isSvelteFilePath } from '../utils';
import { decorateCallHierarchy } from './call-hierarchy';
import { decorateCompletions } from './completions';
import { decorateGetDefinition } from './definition';
import { decorateDiagnostics } from './diagnostics';
import { decorateFindReferences } from './find-references';
import { decorateHover } from './hover';
import { decorateGetImplementation } from './implementation';
import { decorateInlayHints } from './inlay-hints';
import { decorateRename } from './rename';
import { decorateUpdateImports } from './update-imports';
import { decorateLanguageServiceHost } from './host';
import { decorateNavigateToItems } from './navigate-to-items';
import { decorateFileReferences } from './file-references';
import { decorateMoveToRefactoringFileSuggestions } from './move-to-file';
import { decorateQuickFixAndRefactor } from './code-action';

const patchedProject = new Set<string>();

export function isPatched(project: ts.server.Project) {
    return patchedProject.has(project.getProjectName());
}

export function decorateLanguageService(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger,
    configManager: ConfigManager,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    onDispose: () => void
) {
    patchedProject.add(info.project.getProjectName());

    // Decorate using a proxy so we can dynamically enable/disable method
    // patches depending on the enabled state of our config
    const proxy = new Proxy(ls, createProxyHandler(configManager));
    decorateLanguageServiceHost(info.languageServiceHost);
    decorateLanguageServiceInner(proxy, snapshotManager, logger, info, typescript, onDispose);

    return proxy;
}

function decorateLanguageServiceInner(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    onDispose: () => void
): ts.LanguageService {
    patchLineColumnOffset(ls, snapshotManager);
    decorateRename(ls, snapshotManager, logger);
    decorateDiagnostics(ls, info, typescript, logger);
    decorateFindReferences(ls, snapshotManager, logger);
    decorateCompletions(ls, info, typescript, logger);
    decorateGetDefinition(ls, info, typescript, snapshotManager, logger);
    decorateGetImplementation(ls, snapshotManager, logger);
    decorateUpdateImports(ls, snapshotManager, logger);
    decorateCallHierarchy(ls, snapshotManager, typescript);
    decorateHover(ls, info, typescript, logger);
    decorateInlayHints(ls, info, typescript, logger);
    decorateNavigateToItems(ls, snapshotManager);
    decorateFileReferences(ls, snapshotManager);
    decorateMoveToRefactoringFileSuggestions(ls);
    decorateQuickFixAndRefactor(ls, typescript, snapshotManager);
    decorateDispose(ls, info.project, onDispose);
    return ls;
}

function createProxyHandler(configManager: ConfigManager): ProxyHandler<ts.LanguageService> {
    const decorated: Partial<ts.LanguageService> = {};

    return {
        get(target, p) {
            // always check for decorated dispose
            if (!configManager.getConfig().enable && p !== 'dispose') {
                return target[p as keyof ts.LanguageService];
            }

            return (
                decorated[p as keyof ts.LanguageService] ?? target[p as keyof ts.LanguageService]
            );
        },
        set(_, p, value) {
            decorated[p as keyof ts.LanguageService] = value;

            return true;
        }
    };
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

function decorateDispose(
    ls: ts.LanguageService,
    project: ts.server.Project,
    onDispose: () => void
) {
    const dispose = ls.dispose;

    ls.dispose = () => {
        patchedProject.delete(project.getProjectName());
        onDispose();
        dispose();
    };

    return ls;
}
