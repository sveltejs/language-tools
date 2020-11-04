import ts, { NavigationTree } from 'typescript';
import {
    CodeAction,
    CodeActionContext,
    CompletionContext,
    DefinitionLink,
    Diagnostic,
    FileChangeType,
    Hover,
    Location,
    LocationLink,
    Position,
    Range,
    ReferenceContext,
    SymbolInformation,
    WorkspaceEdit,
    CompletionList,
    SelectionRange,
    SignatureHelp,
    SignatureHelpContext
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    mapSymbolInformationToOriginal,
    getTextInRange
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
    FindReferencesProvider,
    HoverProvider,
    OnWatchFileChanges,
    RenameProvider,
    SelectionRangeProvider,
    SignatureHelpProvider,
    UpdateImportsProvider,
    OnWatchFileChangesPara
} from '../interfaces';
import { SnapshotFragment } from './DocumentSnapshot';
import { CodeActionsProviderImpl } from './features/CodeActionsProvider';
import {
    CompletionEntryWithIdentifer,
    CompletionsProviderImpl
} from './features/CompletionProvider';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { HoverProviderImpl } from './features/HoverProvider';
import { RenameProviderImpl } from './features/RenameProvider';
import { UpdateImportsProviderImpl } from './features/UpdateImportsProvider';
import { LSAndTSDocResolver } from './LSAndTSDocResolver';
import { convertToLocationRange, getScriptKindFromFileName, symbolKindFromString } from './utils';
import { getDirectiveCommentCompletions } from './features/getDirectiveCommentCompletions';
import { FindReferencesProviderImpl } from './features/FindReferencesProvider';
import { SelectionRangeProviderImpl } from './features/SelectionRangeProvider';
import { SignatureHelpProviderImpl } from './features/SignatureHelpProvider';
import { SnapshotManager } from './SnapshotManager';

export class TypeScriptPlugin
    implements
        DiagnosticsProvider,
        HoverProvider,
        DocumentSymbolsProvider,
        DefinitionsProvider,
        CodeActionsProvider,
        UpdateImportsProvider,
        RenameProvider,
        FindReferencesProvider,
        SelectionRangeProvider,
        SignatureHelpProvider,
        OnWatchFileChanges,
        CompletionsProvider<CompletionEntryWithIdentifer> {
    private readonly configManager: LSConfigManager;
    private readonly lsAndTsDocResolver: LSAndTSDocResolver;
    private readonly completionProvider: CompletionsProviderImpl;
    private readonly codeActionsProvider: CodeActionsProviderImpl;
    private readonly updateImportsProvider: UpdateImportsProviderImpl;
    private readonly diagnosticsProvider: DiagnosticsProviderImpl;
    private readonly renameProvider: RenameProviderImpl;
    private readonly hoverProvider: HoverProviderImpl;
    private readonly findReferencesProvider: FindReferencesProviderImpl;
    private readonly selectionRangeProvider: SelectionRangeProviderImpl;
    private readonly signatureHelpProvider: SignatureHelpProviderImpl;

    constructor(
        docManager: DocumentManager,
        configManager: LSConfigManager,
        workspaceUris: string[]
    ) {
        this.configManager = configManager;
        this.lsAndTsDocResolver = new LSAndTSDocResolver(docManager, workspaceUris);
        this.completionProvider = new CompletionsProviderImpl(this.lsAndTsDocResolver);
        this.codeActionsProvider = new CodeActionsProviderImpl(
            this.lsAndTsDocResolver,
            this.completionProvider
        );
        this.updateImportsProvider = new UpdateImportsProviderImpl(this.lsAndTsDocResolver);
        this.diagnosticsProvider = new DiagnosticsProviderImpl(this.lsAndTsDocResolver);
        this.renameProvider = new RenameProviderImpl(this.lsAndTsDocResolver);
        this.hoverProvider = new HoverProviderImpl(this.lsAndTsDocResolver);
        this.findReferencesProvider = new FindReferencesProviderImpl(this.lsAndTsDocResolver);
        this.selectionRangeProvider = new SelectionRangeProviderImpl(this.lsAndTsDocResolver);
        this.signatureHelpProvider = new SignatureHelpProviderImpl(this.lsAndTsDocResolver);
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

        return this.hoverProvider.doHover(document, position);
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
                // Filter those out to keep the lsp from throwing errors.
                // Also filter out transformation artifacts
                .filter(
                    (symbol) =>
                        symbol.location.range.start.line >= 0 &&
                        symbol.location.range.end.line >= 0 &&
                        !symbol.name.startsWith('__sveltets_')
                )
                .map((symbol) => {
                    if (symbol.name !== '<function>') {
                        return symbol;
                    }

                    let name = getTextInRange(symbol.location.range, document.getText()).trimLeft();
                    if (name.length > 50) {
                        name = name.substring(0, 50) + '...';
                    }
                    return {
                        ...symbol,
                        name
                    };
                })
        );

        function collectSymbols(
            tree: NavigationTree,
            container: string | undefined,
            cb: (symbol: SymbolInformation) => void
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
                            fragment.positionAt(end.start + end.length)
                        ),
                        fragment.getURL(),
                        container
                    )
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
        completionContext?: CompletionContext
    ): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const tsDirectiveCommentCompletions = getDirectiveCommentCompletions(
            position,
            document,
            completionContext
        );

        const completions = await this.completionProvider.getCompletions(
            document,
            position,
            completionContext
        );

        if (completions && tsDirectiveCommentCompletions) {
            return CompletionList.create(
                completions.items.concat(tsDirectiveCommentCompletions.items),
                completions.isIncomplete
            );
        }

        return completions ?? tsDirectiveCommentCompletions;
    }

    async resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>
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
            fragment.offsetAt(fragment.getGeneratedPosition(position))
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
                    convertToLocationRange(fragment, defs.textSpan)
                );
            })
        );
    }

    async prepareRename(document: Document, position: Position): Promise<Range | null> {
        if (!this.featureEnabled('rename')) {
            return null;
        }

        return this.renameProvider.prepareRename(document, position);
    }

    async rename(
        document: Document,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        if (!this.featureEnabled('rename')) {
            return null;
        }

        return this.renameProvider.rename(document, position, newName);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        return this.codeActionsProvider.getCodeActions(document, range, context);
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | null> {
        if (!this.featureEnabled('codeActions')) {
            return null;
        }

        return this.codeActionsProvider.executeCommand(document, command, args);
    }

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        if (
            !(
                this.configManager.enabled('svelte.enable') &&
                this.configManager.enabled('svelte.rename.enable')
            )
        ) {
            return null;
        }

        return this.updateImportsProvider.updateImports(fileRename);
    }

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        if (!this.featureEnabled('findReferences')) {
            return null;
        }

        return this.findReferencesProvider.findReferences(document, position, context);
    }

    onWatchFileChanges(onWatchFileChangesParas: OnWatchFileChangesPara[]) {
        const doneUpdateProjectFiles = new Set<SnapshotManager>();

        for (const { fileName, changeType } of onWatchFileChangesParas) {
            const scriptKind = getScriptKindFromFileName(fileName);

            if (scriptKind === ts.ScriptKind.Unknown) {
                // We don't deal with svelte files here
                continue;
            }

            const snapshotManager = this.getSnapshotManager(fileName);
            if (changeType === FileChangeType.Created) {
                if (!doneUpdateProjectFiles.has(snapshotManager)) {
                    snapshotManager.updateProjectFiles();
                    doneUpdateProjectFiles.add(snapshotManager);
                }
            } else if (changeType === FileChangeType.Deleted) {
                snapshotManager.delete(fileName);
                return;
            }

            // Since the options parameter only applies to svelte snapshots, and this is not
            // a svelte file, we can just set it to false without having any effect.
            snapshotManager.updateByFileName(fileName, { strictMode: false });
        }
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<SelectionRange | null> {
        if (!this.featureEnabled('selectionRange')) {
            return null;
        }

        return this.selectionRangeProvider.getSelectionRange(document, position);
    }

    async getSignatureHelp(
        document: Document, position: Position, context: SignatureHelpContext | undefined
    ): Promise<SignatureHelp | null> {
        if (!this.featureEnabled('signatureHelp')) {
            return null;
        }

        return this.signatureHelpProvider.getSignatureHelp(document, position, context);
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }

    /**
     *
     * @internal
     */
    public getSnapshotManager(fileName: string) {
        return this.lsAndTsDocResolver.getSnapshotManager(fileName);
    }

    private featureEnabled(feature: keyof LSTypescriptConfig) {
        return (
            this.configManager.enabled('typescript.enable') &&
            this.configManager.enabled(`typescript.${feature}.enable`)
        );
    }
}
