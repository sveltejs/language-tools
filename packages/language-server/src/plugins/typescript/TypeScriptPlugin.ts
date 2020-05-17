import ts, { NavigationTree } from 'typescript';
import {
    CodeAction,
    CodeActionContext,
    CompletionContext,
    DefinitionLink,
    Diagnostic,
    DiagnosticSeverity,
    FileChangeType,
    Hover,
    LocationLink,
    Position,
    Range,
    SymbolInformation,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    mapDiagnosticToOriginal,
    mapHoverToParent,
    mapRangeToOriginal,
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
    HoverProvider,
    OnWatchFileChanges,
} from '../interfaces';
import { DocumentSnapshot, SnapshotFragment } from './DocumentSnapshot';
import {
    CompletionEntryWithIdentifer,
    CompletionsProviderImpl,
} from './features/CompletionProvider';
import { LSAndTSDocResolver } from './LSAndTSDocResolver';
import {
    convertRange,
    convertToLocationRange,
    getScriptKindFromFileName,
    mapSeverity,
    symbolKindFromString,
} from './utils';

export class TypeScriptPlugin
    implements
        DiagnosticsProvider,
        HoverProvider,
        DocumentSymbolsProvider,
        DefinitionsProvider,
        CodeActionsProvider,
        OnWatchFileChanges,
        CompletionsProvider<CompletionEntryWithIdentifer> {
    private configManager: LSConfigManager;
    private readonly lsAndTsDocResolver: LSAndTSDocResolver;
    private readonly completionProvider: CompletionsProviderImpl;

    constructor(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        this.lsAndTsDocResolver = new LSAndTSDocResolver(docManager);
        this.completionProvider = new CompletionsProviderImpl(this.lsAndTsDocResolver);
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const isTypescript = tsDoc.scriptKind === ts.ScriptKind.TSX;

        // Document preprocessing failed, show parser error instead
        if (tsDoc.parserError) {
            return [
                {
                    range: tsDoc.parserError.range,
                    severity: DiagnosticSeverity.Error,
                    source: isTypescript ? 'ts' : 'js',
                    message: tsDoc.parserError.message,
                    code: tsDoc.parserError.code,
                },
            ];
        }

        const diagnostics: ts.Diagnostic[] = [
            ...lang.getSyntacticDiagnostics(tsDoc.filePath),
            ...lang.getSuggestionDiagnostics(tsDoc.filePath),
            ...lang.getSemanticDiagnostics(tsDoc.filePath),
        ];

        const fragment = await tsDoc.getFragment();

        return diagnostics
            .map((diagnostic) => ({
                range: convertRange(tsDoc, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
            }))
            .map((diagnostic) => mapDiagnosticToOriginal(fragment, diagnostic))
            .filter(
                // In some rare cases mapping of diagnostics does not work and produces negative lines.
                // We filter out these diagnostics with negative lines because else the LSP (or VSCode?)
                // apparently has a hickup and does not show any diagnostics at all.
                (diagnostic) => diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0,
            );
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
        return symbols
            .slice(1)
            .map((symbol) => {
                if (symbol.containerName === topContainerName) {
                    return { ...symbol, containerName: 'script' };
                }

                return symbol;
            })
            .map((symbol) => mapSymbolInformationToOriginal(fragment, symbol));

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

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const start = fragment.offsetAt(fragment.getGeneratedPosition(range.start));
        const end = fragment.offsetAt(fragment.getGeneratedPosition(range.end));
        const errorCodes: number[] = context.diagnostics.map((diag) => Number(diag.code));
        const codeFixes = lang.getCodeFixesAtPosition(
            tsDoc.filePath,
            start,
            end,
            errorCodes,
            {},
            {},
        );

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);
        return await Promise.all(
            codeFixes.map(async (fix) => {
                const documentChanges = await Promise.all(
                    fix.changes.map(async (change) => {
                        let doc = docs.get(change.fileName);
                        if (!doc) {
                            doc = await this.getSnapshot(change.fileName).getFragment();
                            docs.set(change.fileName, doc);
                        }
                        return TextDocumentEdit.create(
                            VersionedTextDocumentIdentifier.create(
                                pathToUrl(change.fileName),
                                null,
                            ),
                            change.textChanges.map((edit) => {
                                return TextEdit.replace(
                                    mapRangeToOriginal(doc!, convertRange(doc!, edit.span)),
                                    edit.newText,
                                );
                            }),
                        );
                    }),
                );
                return CodeAction.create(
                    fix.description,
                    {
                        documentChanges,
                    },
                    fix.fixName,
                );
            }),
        );
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

        const newSnapshot = DocumentSnapshot.fromFilePath(fileName);
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
