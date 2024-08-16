import ts, { NavigationTree } from 'typescript';
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeLens,
    CompletionContext,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    FileChangeType,
    FoldingRange,
    Hover,
    InlayHint,
    Location,
    LocationLink,
    Position,
    Range,
    ReferenceContext,
    SelectionRange,
    SemanticTokens,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    SymbolKind,
    TextDocumentContentChangeEvent,
    WorkspaceEdit
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    getTextInRange,
    mapSymbolInformationToOriginal
} from '../../lib/documents';
import { LSConfigManager, LSTypescriptConfig } from '../../ls-config';
import { isNotNullOrUndefined, isZeroLengthRange, pathToUrl } from '../../utils';
import {
    AppCompletionItem,
    AppCompletionList,
    CallHierarchyProvider,
    CodeActionsProvider,
    CodeLensProvider,
    CompletionsProvider,
    DefinitionsProvider,
    DiagnosticsProvider,
    DocumentSymbolsProvider,
    FileReferencesProvider,
    FileRename,
    FindComponentReferencesProvider,
    FindReferencesProvider,
    FoldingRangeProvider,
    HoverProvider,
    ImplementationProvider,
    InlayHintProvider,
    OnWatchFileChanges,
    OnWatchFileChangesPara,
    RenameProvider,
    SelectionRangeProvider,
    SemanticTokensProvider,
    SignatureHelpProvider,
    TypeDefinitionProvider,
    UpdateImportsProvider,
    UpdateTsOrJsFile
} from '../interfaces';
import { LSAndTSDocResolver } from './LSAndTSDocResolver';
import { ignoredBuildDirectories } from './SnapshotManager';
import { CodeActionsProviderImpl } from './features/CodeActionsProvider';
import { CompletionResolveInfo, CompletionsProviderImpl } from './features/CompletionProvider';
import { DiagnosticsProviderImpl } from './features/DiagnosticsProvider';
import { FindComponentReferencesProviderImpl } from './features/FindComponentReferencesProvider';
import { FindFileReferencesProviderImpl } from './features/FindFileReferencesProvider';
import { FindReferencesProviderImpl } from './features/FindReferencesProvider';
import { FoldingRangeProviderImpl } from './features/FoldingRangeProvider';
import { HoverProviderImpl } from './features/HoverProvider';
import { ImplementationProviderImpl } from './features/ImplementationProvider';
import { InlayHintProviderImpl } from './features/InlayHintProvider';
import { RenameProviderImpl } from './features/RenameProvider';
import { SelectionRangeProviderImpl } from './features/SelectionRangeProvider';
import { SemanticTokensProviderImpl } from './features/SemanticTokensProvider';
import { SignatureHelpProviderImpl } from './features/SignatureHelpProvider';
import { TypeDefinitionProviderImpl } from './features/TypeDefinitionProvider';
import { UpdateImportsProviderImpl } from './features/UpdateImportsProvider';
import { getDirectiveCommentCompletions } from './features/getDirectiveCommentCompletions';
import {
    SnapshotMap,
    is$storeVariableIn$storeDeclaration,
    isTextSpanInGeneratedCode
} from './features/utils';
import { isAttributeName, isAttributeShorthand, isEventHandler } from './svelte-ast-utils';
import {
    convertToLocationForReferenceOrDefinition,
    convertToLocationRange,
    isInScript,
    isSvelte2tsxShimFile,
    isSvelteFilePath,
    symbolKindFromString
} from './utils';
import { CallHierarchyProviderImpl } from './features/CallHierarchyProvider';
import { CodeLensProviderImpl } from './features/CodeLensProvider';

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
        FileReferencesProvider,
        FindComponentReferencesProvider,
        SelectionRangeProvider,
        SignatureHelpProvider,
        SemanticTokensProvider,
        ImplementationProvider,
        TypeDefinitionProvider,
        InlayHintProvider,
        CallHierarchyProvider,
        FoldingRangeProvider,
        CodeLensProvider,
        OnWatchFileChanges,
        CompletionsProvider<CompletionResolveInfo>,
        UpdateTsOrJsFile
{
    __name = 'ts';
    private readonly configManager: LSConfigManager;
    private readonly documentManager: DocumentManager;
    private readonly lsAndTsDocResolver: LSAndTSDocResolver;
    private readonly completionProvider: CompletionsProviderImpl;
    private readonly codeActionsProvider: CodeActionsProviderImpl;
    private readonly updateImportsProvider: UpdateImportsProviderImpl;
    private readonly diagnosticsProvider: DiagnosticsProviderImpl;
    private readonly renameProvider: RenameProviderImpl;
    private readonly hoverProvider: HoverProviderImpl;
    private readonly findReferencesProvider: FindReferencesProviderImpl;
    private readonly findFileReferencesProvider: FindFileReferencesProviderImpl;
    private readonly findComponentReferencesProvider: FindComponentReferencesProviderImpl;

    private readonly selectionRangeProvider: SelectionRangeProviderImpl;
    private readonly signatureHelpProvider: SignatureHelpProviderImpl;
    private readonly semanticTokensProvider: SemanticTokensProviderImpl;
    private readonly implementationProvider: ImplementationProviderImpl;
    private readonly typeDefinitionProvider: TypeDefinitionProviderImpl;
    private readonly inlayHintProvider: InlayHintProviderImpl;
    private readonly foldingRangeProvider: FoldingRangeProviderImpl;
    private readonly callHierarchyProvider: CallHierarchyProviderImpl;
    private readonly codLensProvider: CodeLensProviderImpl;

    constructor(
        configManager: LSConfigManager,
        lsAndTsDocResolver: LSAndTSDocResolver,
        workspaceUris: string[],
        documentManager: DocumentManager
    ) {
        this.configManager = configManager;
        this.documentManager = documentManager;
        this.lsAndTsDocResolver = lsAndTsDocResolver;
        this.completionProvider = new CompletionsProviderImpl(
            this.lsAndTsDocResolver,
            this.configManager
        );
        this.codeActionsProvider = new CodeActionsProviderImpl(
            this.lsAndTsDocResolver,
            this.completionProvider,
            configManager
        );
        this.updateImportsProvider = new UpdateImportsProviderImpl(
            this.lsAndTsDocResolver,
            ts.sys.useCaseSensitiveFileNames
        );
        this.diagnosticsProvider = new DiagnosticsProviderImpl(
            this.lsAndTsDocResolver,
            configManager
        );
        this.renameProvider = new RenameProviderImpl(this.lsAndTsDocResolver, configManager);
        this.hoverProvider = new HoverProviderImpl(this.lsAndTsDocResolver);
        this.findFileReferencesProvider = new FindFileReferencesProviderImpl(
            this.lsAndTsDocResolver
        );
        this.findComponentReferencesProvider = new FindComponentReferencesProviderImpl(
            this.lsAndTsDocResolver
        );
        this.findReferencesProvider = new FindReferencesProviderImpl(
            this.lsAndTsDocResolver,
            this.findComponentReferencesProvider
        );
        this.selectionRangeProvider = new SelectionRangeProviderImpl(this.lsAndTsDocResolver);
        this.signatureHelpProvider = new SignatureHelpProviderImpl(this.lsAndTsDocResolver);
        this.semanticTokensProvider = new SemanticTokensProviderImpl(this.lsAndTsDocResolver);
        this.implementationProvider = new ImplementationProviderImpl(this.lsAndTsDocResolver);
        this.typeDefinitionProvider = new TypeDefinitionProviderImpl(this.lsAndTsDocResolver);
        this.inlayHintProvider = new InlayHintProviderImpl(this.lsAndTsDocResolver);
        this.callHierarchyProvider = new CallHierarchyProviderImpl(
            this.lsAndTsDocResolver,
            workspaceUris
        );
        this.foldingRangeProvider = new FoldingRangeProviderImpl(
            this.lsAndTsDocResolver,
            configManager
        );
        this.codLensProvider = new CodeLensProviderImpl(
            this.lsAndTsDocResolver,
            this.findReferencesProvider,
            this.implementationProvider,
            this.configManager
        );
    }

    async getDiagnostics(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        return this.diagnosticsProvider.getDiagnostics(document, cancellationToken);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return this.hoverProvider.doHover(document, position);
    }

    async getDocumentSymbols(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<SymbolInformation[]> {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }

        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        const navTree = lang.getNavigationTree(tsDoc.filePath);

        const symbols: SymbolInformation[] = [];
        collectSymbols(navTree, undefined, (symbol) => symbols.push(symbol));

        const topContainerName = symbols[0].name;
        const result: SymbolInformation[] = [];

        for (let symbol of symbols.slice(1)) {
            if (symbol.containerName === topContainerName) {
                symbol.containerName = 'script';
            }

            symbol = mapSymbolInformationToOriginal(tsDoc, symbol);

            if (
                symbol.location.range.start.line < 0 ||
                symbol.location.range.end.line < 0 ||
                isZeroLengthRange(symbol.location.range) ||
                symbol.name.startsWith('__sveltets_')
            ) {
                continue;
            }

            if (
                (symbol.kind === SymbolKind.Property || symbol.kind === SymbolKind.Method) &&
                !isInScript(symbol.location.range.start, document)
            ) {
                if (
                    symbol.name === 'props' &&
                    document.getText().charAt(document.offsetAt(symbol.location.range.start)) !==
                        'p'
                ) {
                    // This is the "props" of a generated component constructor
                    continue;
                }
                const node = tsDoc.svelteNodeAt(symbol.location.range.start);
                if (
                    (node && (isAttributeName(node) || isAttributeShorthand(node))) ||
                    isEventHandler(node)
                ) {
                    // This is a html or component property, they are not treated as a new symbol
                    // in JSX and so we do the same for the new transformation.
                    continue;
                }
            }

            if (symbol.name === '<function>') {
                let name = getTextInRange(symbol.location.range, document.getText()).trimLeft();
                if (name.length > 50) {
                    name = name.substring(0, 50) + '...';
                }
                symbol.name = name;
            }

            if (symbol.name.startsWith('$$_')) {
                if (!symbol.name.includes('$on')) {
                    continue;
                }
                // on:foo={() => ''}   ->   $on("foo") callback
                symbol.name = symbol.name.substring(symbol.name.indexOf('$on'));
            }

            result.push(symbol);
        }

        return result;

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
                            tsDoc.positionAt(start.start),
                            tsDoc.positionAt(end.start + end.length)
                        ),
                        tsDoc.getURL(),
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
        completionContext?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<AppCompletionList<CompletionResolveInfo> | null> {
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
            completionContext,
            cancellationToken
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
        completionItem: AppCompletionItem<CompletionResolveInfo>,
        cancellationToken?: CancellationToken
    ): Promise<AppCompletionItem<CompletionResolveInfo>> {
        return this.completionProvider.resolveCompletion(
            document,
            completionItem,
            cancellationToken
        );
    }

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        const { lang, tsDoc, lsContainer } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        const defs = lang.getDefinitionAndBoundSpan(
            tsDoc.filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(position))
        );

        if (!defs || !defs.definitions) {
            return [];
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const result = await Promise.all(
            defs.definitions.map(async (def) => {
                if (isSvelte2tsxShimFile(def.fileName)) {
                    return;
                }

                let snapshot = await snapshots.retrieve(def.fileName);

                // Go from generated $store to store if user wants to find definition for $store
                if (isTextSpanInGeneratedCode(snapshot.getFullText(), def.textSpan)) {
                    if (
                        !is$storeVariableIn$storeDeclaration(
                            snapshot.getFullText(),
                            def.textSpan.start
                        )
                    ) {
                        return;
                    }
                    // there will be exactly one definition, the store
                    def = lang.getDefinitionAndBoundSpan(
                        tsDoc.filePath,
                        tsDoc.getFullText().indexOf(');', def.textSpan.start) - 1
                    )!.definitions![0];
                    snapshot = await snapshots.retrieve(def.fileName);
                }

                const defLocation = convertToLocationForReferenceOrDefinition(
                    snapshot,
                    def.textSpan
                );
                return LocationLink.create(
                    defLocation.uri,
                    defLocation.range,
                    defLocation.range,
                    convertToLocationRange(tsDoc, defs.textSpan)
                );
            })
        );
        return result.filter(isNotNullOrUndefined);
    }

    async prepareRename(document: Document, position: Position): Promise<Range | null> {
        return this.renameProvider.prepareRename(document, position);
    }

    async rename(
        document: Document,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        return this.renameProvider.rename(document, position, newName);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        return this.codeActionsProvider.getCodeActions(document, range, context, cancellationToken);
    }

    async resolveCodeAction(
        document: Document,
        codeAction: CodeAction,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CodeAction> {
        return this.codeActionsProvider.resolveCodeAction(document, codeAction, cancellationToken);
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
        return this.findReferencesProvider.findReferences(document, position, context);
    }

    async fileReferences(uri: string): Promise<Location[] | null> {
        return this.findFileReferencesProvider.fileReferences(uri);
    }

    async findComponentReferences(uri: string): Promise<Location[] | null> {
        return this.findComponentReferencesProvider.findComponentReferences(uri);
    }

    async onWatchFileChanges(onWatchFileChangesParas: OnWatchFileChangesPara[]): Promise<void> {
        const newFiles: string[] = [];

        for (const { fileName, changeType } of onWatchFileChangesParas) {
            const pathParts = fileName.split(/\/|\\/);
            const dirPathParts = pathParts.slice(0, pathParts.length - 1);
            const declarationExtensions = [ts.Extension.Dcts, ts.Extension.Dts, ts.Extension.Dmts];
            const canSafelyIgnore =
                declarationExtensions.every((ext) => !fileName.endsWith(ext)) &&
                ignoredBuildDirectories.some((dir) => {
                    const index = dirPathParts.indexOf(dir);

                    return (
                        // Files in .svelte-kit/types should always come through
                        index > 0 && (dir !== '.svelte-kit' || dirPathParts[index + 1] !== 'types')
                    );
                });
            if (canSafelyIgnore) {
                continue;
            }

            const isSvelteFile = isSvelteFilePath(fileName);
            const isClientSvelteFile =
                isSvelteFile && this.documentManager.get(pathToUrl(fileName))?.openedByClient;

            if (changeType === FileChangeType.Deleted) {
                if (!isClientSvelteFile) {
                    await this.lsAndTsDocResolver.deleteSnapshot(fileName);
                }
                continue;
            }

            if (changeType === FileChangeType.Created) {
                newFiles.push(fileName);
                continue;
            }

            if (isSvelteFile) {
                if (!isClientSvelteFile) {
                    await this.lsAndTsDocResolver.updateExistingSvelteFile(fileName);
                }
                continue;
            }

            await this.lsAndTsDocResolver.updateExistingTsOrJsFile(fileName);
        }

        if (newFiles.length) {
            await this.lsAndTsDocResolver.updateProjectFiles(newFiles);
            await this.lsAndTsDocResolver.invalidateModuleCache(newFiles);
        }
    }

    async updateTsOrJsFile(
        fileName: string,
        changes: TextDocumentContentChangeEvent[]
    ): Promise<void> {
        await this.lsAndTsDocResolver.updateExistingTsOrJsFile(fileName, changes);
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
        document: Document,
        position: Position,
        context: SignatureHelpContext | undefined,
        cancellationToken?: CancellationToken
    ): Promise<SignatureHelp | null> {
        if (!this.featureEnabled('signatureHelp')) {
            return null;
        }

        return this.signatureHelpProvider.getSignatureHelp(
            document,
            position,
            context,
            cancellationToken
        );
    }

    async getSemanticTokens(
        textDocument: Document,
        range?: Range,
        cancellationToken?: CancellationToken
    ): Promise<SemanticTokens | null> {
        if (!this.featureEnabled('semanticTokens')) {
            return {
                data: []
            };
        }

        return this.semanticTokensProvider.getSemanticTokens(
            textDocument,
            range,
            cancellationToken
        );
    }

    async getImplementation(
        document: Document,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<Location[] | null> {
        return this.implementationProvider.getImplementation(document, position, cancellationToken);
    }

    async getTypeDefinition(document: Document, position: Position): Promise<Location[] | null> {
        return this.typeDefinitionProvider.getTypeDefinition(document, position);
    }

    async getInlayHints(
        document: Document,
        range: Range,
        cancellationToken?: CancellationToken
    ): Promise<InlayHint[] | null> {
        if (!this.configManager.enabled('typescript.enable')) {
            return null;
        }

        return this.inlayHintProvider.getInlayHints(document, range, cancellationToken);
    }

    prepareCallHierarchy(
        document: Document,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<CallHierarchyItem[] | null> {
        return this.callHierarchyProvider.prepareCallHierarchy(
            document,
            position,
            cancellationToken
        );
    }

    getIncomingCalls(
        item: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyIncomingCall[] | null> {
        return this.callHierarchyProvider.getIncomingCalls(item, cancellationToken);
    }

    async getOutgoingCalls(
        item: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyOutgoingCall[] | null> {
        return this.callHierarchyProvider.getOutgoingCalls(item, cancellationToken);
    }

    async getFoldingRanges(document: Document): Promise<FoldingRange[]> {
        return this.foldingRangeProvider.getFoldingRanges(document);
    }

    getCodeLens(document: Document): Promise<CodeLens[] | null> {
        return this.codLensProvider.getCodeLens(document);
    }

    resolveCodeLens(
        document: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ): Promise<CodeLens> {
        return this.codLensProvider.resolveCodeLens(document, codeLensToResolve, cancellationToken);
    }

    private featureEnabled(feature: keyof LSTypescriptConfig) {
        return (
            this.configManager.enabled('typescript.enable') &&
            this.configManager.enabled(`typescript.${feature}.enable`)
        );
    }
}
