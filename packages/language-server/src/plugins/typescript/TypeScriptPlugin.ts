import ts, { NavigationTree } from 'typescript';
import {
    CodeAction,
    CodeActionContext,
    CompletionContext,
    DefinitionLink,
    Diagnostic,
    FileChangeType,
    Hover,
    LocationLink,
    Position,
    Range,
    SymbolInformation,
    WorkspaceEdit,
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    mapHoverToParent,
    mapSymbolInformationToOriginal,
} from '../../lib/documents';
import { LSConfigManager, LSTypescriptConfig } from '../../ls-config';
import { pathToUrl } from '../../utils';
import {
    AppCompletionItem,
    AppCompletionList,
    CodeActionsProvider,
    CompletionsProvider,
    DefinitionsProvider,
    DiagnosticsProvider,
    DocumentSymbolsProvider,
    FileRename,
    HoverProvider,
    OnWatchFileChanges,
    UpdateImportsProvider,
} from '../interfaces';
import { DocumentSnapshot, SnapshotFragment } from './DocumentSnapshot';
import { CodeActionsProviderImpl } from './features/CodeActionsProvider';
import {
    CompletionEntryWithIdentifer,
    CompletionsProviderImpl,
} from './features/CompletionProvider';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { UpdateImportsProviderImpl } from './features/UpdateImportsProvider';
import { LSAndTSDocResolver } from './LSAndTSDocResolver';
import {
    convertRange,
    convertToLocationRange,
    getScriptKindFromFileName,
    symbolKindFromString,
} from './utils';

export class TypeScriptPlugin
    implements
        DiagnosticsProvider,
        HoverProvider,
        DocumentSymbolsProvider,
        DefinitionsProvider,
        CodeActionsProvider,
        UpdateImportsProvider,
        OnWatchFileChanges,
        CompletionsProvider<CompletionEntryWithIdentifer> {
    private readonly configManager: LSConfigManager;
    private readonly lsAndTsDocResolver: LSAndTSDocResolver;
    private readonly completionProvider: CompletionsProviderImpl;
    private readonly codeActionsProvider: CodeActionsProviderImpl;
    private readonly updateImportsProvider: UpdateImportsProviderImpl;
    private readonly diagnosticsProvider: DiagnosticsProviderImpl;

    constructor(
        docManager: DocumentManager,
        configManager: LSConfigManager,
        workspacePath: string,
    ) {
        this.configManager = configManager;
        this.lsAndTsDocResolver = new LSAndTSDocResolver(docManager, workspacePath);
        this.completionProvider = new CompletionsProviderImpl(this.lsAndTsDocResolver);
        this.codeActionsProvider = new CodeActionsProviderImpl(this.lsAndTsDocResolver);
        this.updateImportsProvider = new UpdateImportsProviderImpl(this.lsAndTsDocResolver);
        this.diagnosticsProvider = new DiagnosticsProviderImpl(this.lsAndTsDocResolver);
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        return this.diagnosticsProvider.getDiagnostics(document);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const info = lang.getQuickInfoAtPosition(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position)),
        );
        if (!info) {
            return null;
        }
        const contents = ts.displayPartsToString(info.displayParts);
        return mapHoverToParent(fragment, {
            range: convertRange(fragment, info.textSpan),
            contents: { language: 'ts', value: contents },
        });
    }

    async getDocumentSymbols(document: Document): Promise<SymbolInformation[]> {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const navTree = lang.getNavigationTree(tsDoc.filePath);

        const symbols: SymbolInformation[] = [];
        collectSymbols(navTree, undefined, (symbol) => symbols.push(symbol));

        const topContainerName = symbols[0].name;
        return (
            symbols
                .slice(1)
                .map((symbol) => {
                    if (symbol.containerName === topContainerName) {
                        return { ...symbol, containerName: 'script' };
                    }

                    return symbol;
                })
                .map((symbol) => mapSymbolInformationToOriginal(fragment, symbol))
                // Due to svelte2tsx, there will also be some symbols that are unmapped.
                // Filter those out to keep the lsp from throwing errors
                .filter(
                    (symbol) =>
                        symbol.location.range.start.line >= 0 &&
                        symbol.location.range.end.line >= 0,
                )
        );

        function collectSymbols(
            tree: NavigationTree,
            container: string | undefined,
            cb: (symbol: SymbolInformation) => void,
        ) {
            const start = tree.spans[0];
            const end = tree.spans[tree.spans.length - 1];
            if (start && end) {
                cb(
                    SymbolInformation.create(
                        tree.text,
                        symbolKindFromString(tree.kind),
                        Range.create(
                            fragment.positionAt(start.start),
                            fragment.positionAt(end.start + end.length),
                        ),
                        fragment.getURL(),
                        container,
                    ),
                );
            }
            if (tree.childItems) {
                for (const child of tree.childItems) {
                    collectSymbols(child, tree.text, cb);
                }
            }
        }
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext,
    ): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        return this.completionProvider.getCompletions(document, position, completionContext);
    }

    async resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>,
    ): Promise<AppCompletionItem<CompletionEntryWithIdentifer>> {
        return this.completionProvider.resolveCompletion(document, completionItem);
    }

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        if (!this.featureEnabled('definitions')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const defs = lang.getDefinitionAndBoundSpan(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position)),
        );

        if (!defs || !defs.definitions) {
            return [];
        }

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);

        return await Promise.all(
            defs.definitions.map(async (def) => {
                let defDoc = docs.get(def.fileName);
                if (!defDoc) {
                    defDoc = await this.getSnapshot(def.fileName).getFragment();
                    docs.set(def.fileName, defDoc);
                }

                return LocationLink.create(
                    pathToUrl(def.fileName),
                    convertToLocationRange(defDoc, def.textSpan),
                    convertToLocationRange(defDoc, def.textSpan),
                    convertToLocationRange(fragment, defs.textSpan),
                );
            }),
        );
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        return this.codeActionsProvider.getCodeActions(document, range, context);
    }

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        if (!this.featureEnabled('rename')) {
            return null;
        }

        return this.updateImportsProvider.updateImports(fileRename);
    }

    onWatchFileChanges(fileName: string, changeType: FileChangeType) {
        const scriptKind = getScriptKindFromFileName(fileName);

        if (scriptKind === ts.ScriptKind.Unknown) {
            // We don't deal with svelte files here
            return;
        }

        const snapshotManager = this.getSnapshotManager(fileName);

        if (changeType === FileChangeType.Deleted) {
            snapshotManager.delete(fileName);
            return;
        }

        // Since the options parameter only applies to svelte snapshots, and this is not
        // a svelte file, we can just set it to false without having any effect.
        const newSnapshot = DocumentSnapshot.fromFilePath(fileName, { strictMode: false });
        const previousSnapshot = snapshotManager.get(fileName);

        if (previousSnapshot) {
            newSnapshot.version = previousSnapshot.version + 1;
        } else {
            // ensure it's greater than initial version
            // so that ts server picks up the change
            newSnapshot.version += 1;
        }

        snapshotManager.set(fileName, newSnapshot);
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }

    private getSnapshotManager(fileName: string) {
        return this.lsAndTsDocResolver.getSnapshotManager(fileName);
    }

    private featureEnabled(feature: keyof LSTypescriptConfig) {
        return (
            this.configManager.enabled('typescript.enable') &&
            this.configManager.enabled(`typescript.${feature}.enable`)
        );
    }
}
