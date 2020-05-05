import ts, { NavigationTree } from 'typescript';
import {
    CodeAction,
    CodeActionContext,
    CompletionItem,
    CompletionList,
    DefinitionLink,
    Diagnostic,
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
    mapCodeActionToParent,
    mapCompletionItemToParent,
    mapDiagnosticToParent,
    mapHoverToParent,
    mapSymbolInformationToParent,
    TextDocument,
    mapLocationLinkToParent,
} from '../../lib/documents';
import { LSConfigManager, LSTypescriptConfig } from '../../ls-config';
import { pathToUrl } from '../../utils';
import {
    CodeActionsProvider,
    CompletionsProvider,
    DefinitionsProvider,
    DiagnosticsProvider,
    DocumentSymbolsProvider,
    HoverProvider,
    OnRegister,
    OnWatchFileChanges,
} from '../interfaces';
import { DocumentSnapshot, SnapshotFragment } from './DocumentSnapshot';
import { CreateDocument, getLanguageServiceForDocument } from './service';
import { SnapshotManager } from './SnapshotManager';
import {
    convertRange,
    convertToLocationRange,
    findTsConfigPath,
    getCommitCharactersForScriptElement,
    getScriptKindFromFileName,
    mapSeverity,
    scriptElementKindToCompletionItemKind,
    symbolKindFromString,
} from './utils';

export class TypeScriptPlugin
    implements
        OnRegister,
        DiagnosticsProvider,
        HoverProvider,
        DocumentSymbolsProvider,
        CompletionsProvider,
        DefinitionsProvider,
        CodeActionsProvider,
        OnWatchFileChanges {
    private configManager!: LSConfigManager;
    private createDocument!: CreateDocument;

    onRegister(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        this.createDocument = (fileName, content) => {
            const uri = pathToUrl(fileName);
            const document = docManager.openDocument({
                languageId: '',
                text: content,
                uri,
                version: 0,
            });
            docManager.lockDocument(uri);
            return document;
        };
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const isTypescript = tsDoc.scriptKind === ts.ScriptKind.TSX;

        const diagnostics: ts.Diagnostic[] = [
            ...lang.getSyntacticDiagnostics(tsDoc.filePath),
            ...lang.getSuggestionDiagnostics(tsDoc.filePath),
            ...lang.getSemanticDiagnostics(tsDoc.filePath),
        ];

        const fragment = await tsDoc.getFragment();

        return diagnostics
            .map(diagnostic => ({
                range: convertRange(tsDoc, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
            }))
            .map(diagnostic => mapDiagnosticToParent(fragment, diagnostic))
            .filter(
                diagnostic => diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0,
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
            fragment.offsetAt(fragment.positionInFragment(position)),
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
        collectSymbols(navTree, undefined, symbol => symbols.push(symbol));

        const topContainerName = symbols[0].name;
        return symbols
            .slice(1)
            .map(symbol => {
                if (symbol.containerName === topContainerName) {
                    return { ...symbol, containerName: 'script' };
                }

                return symbol;
            })
            .map(symbol => mapSymbolInformationToParent(fragment, symbol));

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
        triggerCharacter?: string,
    ): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        // The language service throws an error if the character is not a valid trigger character.
        // Also, the completions are worse.
        // Therefore, only use the characters the typescript compiler treats as valid.
        const validTriggerCharacter = ['.', '"', "'", '`', '/', '@', '<', '#'].includes(
            triggerCharacter!,
        )
            ? triggerCharacter
            : undefined;
        const completions = lang.getCompletionsAtPosition(
            tsDoc.filePath,
            fragment.offsetAt(fragment.positionInFragment(position)),
            {
                includeCompletionsForModuleExports: true,
                triggerCharacter: validTriggerCharacter as any,
            },
        );

        if (!completions) {
            return null;
        }

        return CompletionList.create(
            completions!.entries
                .map(comp => {
                    return <CompletionItem>{
                        label: comp.name,
                        kind: scriptElementKindToCompletionItemKind(comp.kind),
                        sortText: comp.sortText,
                        commitCharacters: getCommitCharactersForScriptElement(comp.kind),
                        preselect: comp.isRecommended,
                    };
                })
                .map(comp => mapCompletionItemToParent(fragment, comp)),
        );
    }

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        if (!this.featureEnabled('definitions')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const defs = lang.getDefinitionAndBoundSpan(
            tsDoc.filePath,
            fragment.offsetAt(fragment.positionInFragment(position)),
        );

        if (!defs || !defs.definitions) {
            return [];
        }

        const docs = new Map<string, { positionAt: (offset: number) => Position }>([
            [tsDoc.filePath, fragment],
        ]);

        return defs.definitions
            .map(def => {
                let defDoc = docs.get(def.fileName);
                if (!defDoc) {
                    defDoc = new TextDocument(
                        pathToUrl(def.fileName),
                        ts.sys.readFile(def.fileName) || '',
                    );
                    docs.set(def.fileName, defDoc);
                }

                return LocationLink.create(
                    pathToUrl(def.fileName),
                    convertRange(defDoc, def.textSpan),
                    convertRange(defDoc, def.textSpan),
                    convertRange(fragment, defs.textSpan),
                );
            })
            .filter(def => !!def)
            .map(def => mapLocationLinkToParent(fragment, def)) as DefinitionLink[];
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

        const start = fragment.offsetAt(fragment.positionInFragment(range.start));
        const end = fragment.offsetAt(fragment.positionInFragment(range.end));
        const errorCodes: number[] = context.diagnostics.map(diag => Number(diag.code));
        const codeFixes = lang.getCodeFixesAtPosition(
            tsDoc.filePath,
            start,
            end,
            errorCodes,
            {},
            {},
        );

        const docs = new Map<string, { positionAt: (offset: number) => Position }>([
            [tsDoc.filePath, fragment],
        ]);
        return codeFixes
            .map(fix => {
                return CodeAction.create(
                    fix.description,
                    {
                        documentChanges: fix.changes.map(change => {
                            let doc = docs.get(change.fileName);
                            if (!doc) {
                                doc = new TextDocument(
                                    pathToUrl(change.fileName),
                                    ts.sys.readFile(change.fileName) || '',
                                );
                                docs.set(change.fileName, doc);
                            }

                            return TextDocumentEdit.create(
                                VersionedTextDocumentIdentifier.create(
                                    pathToUrl(change.fileName),
                                    null,
                                ),
                                change.textChanges.map(edit => {
                                    return TextEdit.replace(
                                        convertRange(doc!, edit.span),
                                        edit.newText,
                                    );
                                }),
                            );
                        }),
                    },
                    fix.fixName,
                );
            })
            .map(fix => mapCodeActionToParent(fragment, fix));
    }

    onWatchFileChanges(fileName: string, changeType: FileChangeType) {
        const scriptKind = getScriptKindFromFileName(fileName);

        if (scriptKind === ts.ScriptKind.Unknown) {
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
        }

        snapshotManager.set(fileName, newSnapshot);
    }

    private getLSAndTSDoc(document: Document) {
        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const filePath = document.getFilePath()!;
        const tsDoc = this.getSnapshot(filePath, document);

        return { tsDoc, lang };
    }

    private getSnapshot(filePath: string, document?: Document) {
        const snapshotManager = this.getSnapshotManager(filePath);

        let tsDoc = snapshotManager.get(filePath);
        if (!tsDoc) {
            tsDoc = document
                ? DocumentSnapshot.fromDocument(document)
                : DocumentSnapshot.fromFilePath(filePath);
            snapshotManager.set(filePath, tsDoc);
        }

        return tsDoc;
    }

    private getSnapshotManager(fileName: string) {
        const tsconfigPath = findTsConfigPath(fileName);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsconfigPath);
        return snapshotManager;
    }

    private featureEnabled(feature: keyof LSTypescriptConfig) {
        return (
            this.configManager.enabled('typescript.enable') &&
            this.configManager.enabled(`typescript.${feature}.enable`)
        );
    }
}
