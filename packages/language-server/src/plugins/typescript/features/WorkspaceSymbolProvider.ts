import { internalHelpers } from 'svelte2tsx';
import ts from 'typescript';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { SymbolKind, SymbolTag, WorkspaceSymbol } from 'vscode-languageserver-types';
import { mapLocationToOriginal } from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { isNotNullOrUndefined } from '../../../utils';
import { WorkspaceSymbolsProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { forAllServices, LanguageServiceContainer } from '../service';
import {
    convertRange,
    isGeneratedSvelteComponentName,
    isInScript,
    isSvelteFilePath
} from '../utils';
import { isInGeneratedCode, SnapshotMap } from './utils';

export class WorkspaceSymbolsProviderImpl implements WorkspaceSymbolsProvider {
    constructor(lsAndTsDocResolver: LSAndTSDocResolver, configManager: LSConfigManager) {
        this.configManager = configManager;
        this.lsAndTsDocResolver = lsAndTsDocResolver;
    }

    private readonly configManager: LSConfigManager;
    private readonly lsAndTsDocResolver: LSAndTSDocResolver;

    async getWorkspaceSymbols(
        query: string,
        cancellationToken?: CancellationToken
    ): Promise<WorkspaceSymbol[] | null> {
        const allServices: LanguageServiceContainer[] = [];
        await forAllServices((service) => {
            allServices.push(service);
        });

        const symbols = new Map<string, Array<[ts.NavigateToItem, WorkspaceSymbol | undefined]>>();

        // The config only exists for typescript. No javascript counterpart.
        const preference = this.configManager.getTsUserPreferences('typescript', null);

        for (const ls of allServices) {
            if (cancellationToken?.isCancellationRequested) {
                return null;
            }
            const service = ls.getService();
            const projectItems = service.getNavigateToItems(
                query,
                /* maxResultCount */ 256,
                /* fileName */ undefined,
                /* excludeDtsFiles */ ls.snapshotManager.allFilesAreJsOrDts(),
                preference.excludeLibrarySymbolsInNavTo
            );

            const snapshots = new SnapshotMap(this.lsAndTsDocResolver, ls);
            for (const item of projectItems) {
                if (
                    this.isGeneratedName(item) ||
                    (item.kind === ts.ScriptElementKind.alias && !item.containerName)
                ) {
                    continue;
                }
                const seen = symbols.get(item.name);
                if (!seen) {
                    symbols.set(item.name, [
                        [
                            item,
                            this.mapWorkspaceSymbol(item, await snapshots.retrieve(item.fileName))
                        ]
                    ]);
                    continue;
                }

                let skip = false;
                for (const [seenItem] of seen) {
                    if (this.navigateToItemIsEqualTo(seenItem, item)) {
                        skip = true;
                        break;
                    }
                }

                if (skip) {
                    continue;
                }
                const snapshot = await snapshots.retrieve(item.fileName);
                if (
                    snapshot instanceof SvelteDocumentSnapshot &&
                    isInGeneratedCode(snapshot.getFullText(), item.textSpan.start)
                ) {
                    continue;
                }
                seen.push([
                    item,
                    this.mapWorkspaceSymbol(item, await snapshots.retrieve(item.fileName))
                ]);
            }
        }

        return Array.from(symbols.values())
            .flatMap((items) => items.map(([_, symbol]) => symbol))
            .filter(isNotNullOrUndefined);
    }

    private isGeneratedName(item: ts.NavigateToItem) {
        if (!isSvelteFilePath(item.fileName)) {
            return false;
        }

        return (
            item.name === internalHelpers.renderName ||
            item.name.startsWith('__sveltets_') ||
            item.name.startsWith('$$')
        );
    }

    private mapWorkspaceSymbol(
        item: ts.NavigateToItem,
        snapshot: DocumentSnapshot
    ): WorkspaceSymbol | undefined {
        let location = mapLocationToOriginal(snapshot, convertRange(snapshot, item.textSpan));
        if (location.range.start.line < 0) {
            if (isGeneratedSvelteComponentName(item.name)) {
                location = {
                    uri: snapshot.getURL(),
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 1 }
                    }
                };
            } else {
                return undefined;
            }
        }

        return {
            kind: this.convertSymbolKindForWorkspaceSymbol(item.kind),
            name: this.getLabel(item),
            containerName:
                snapshot instanceof SvelteDocumentSnapshot &&
                (item.containerName === internalHelpers.renderName || !item.containerName)
                    ? isInScript(location.range.start, snapshot)
                        ? 'script'
                        : undefined
                    : item.containerName,
            location,
            tags: item.kindModifiers?.includes('deprecated') ? [SymbolTag.Deprecated] : undefined
        };
    }

    /**
     *
     * https://github.com/microsoft/TypeScript/blob/81c951894e93bdc37c6916f18adcd80de76679bc/src/server/session.ts#L2878
     */
    private navigateToItemIsEqualTo(a: ts.NavigateToItem, b: ts.NavigateToItem): boolean {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return (
            a.containerKind === b.containerKind &&
            a.containerName === b.containerName &&
            a.fileName === b.fileName &&
            a.isCaseSensitive === b.isCaseSensitive &&
            a.kind === b.kind &&
            a.kindModifiers === b.kindModifiers &&
            a.matchKind === b.matchKind &&
            a.name === b.name &&
            a.textSpan.start === b.textSpan.start &&
            a.textSpan.length === b.textSpan.length
        );
    }

    /**
     * Don't reuse our symbolKindFromString function, this should the same as the one in vscode
     * so that vscode deduplicate the symbols from svelte and the typescript server.
     * https://github.com/microsoft/vscode/blob/18ed64835ec8f8227dbd8562d2d9fd9fa339abbb/extensions/typescript-language-features/src/languageFeatures/workspaceSymbols.ts#L17
     */
    private convertSymbolKindForWorkspaceSymbol(kind: string) {
        switch (kind) {
            case ts.ScriptElementKind.memberFunctionElement:
                return SymbolKind.Method;
            case ts.ScriptElementKind.enumElement:
                return SymbolKind.Enum;
            case ts.ScriptElementKind.enumMemberElement:
                return SymbolKind.EnumMember;
            case ts.ScriptElementKind.functionElement:
                return SymbolKind.Function;
            case ts.ScriptElementKind.classElement:
                return SymbolKind.Class;
            case ts.ScriptElementKind.interfaceElement:
                return SymbolKind.Interface;
            case ts.ScriptElementKind.typeElement:
                return SymbolKind.Class;
            case ts.ScriptElementKind.memberVariableElement:
            case ts.ScriptElementKind.memberGetAccessorElement:
            case ts.ScriptElementKind.memberSetAccessorElement:
                return SymbolKind.Field;
            default:
                return SymbolKind.Variable;
        }
    }

    private getLabel(item: ts.NavigateToItem) {
        const label = item.name;
        if (item.kind === 'method' || item.kind === 'function') {
            return label + '()';
        }
        return label;
    }
}
