import ts, { NavigationTree } from 'typescript';
import {
    CodeAction,
    CodeActionContext,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    Hover,
    LocationLink,
    Position,
    Range,
    SymbolInformation,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    FileChangeType,
    TextDocumentIdentifier,
} from 'vscode-languageserver';
import {
    DocumentManager,
    TextDocument,
    Document,
    mapDiagnosticToParent,
    mapHoverToParent,
    mapSymbolInformationToParent,
    mapCompletionItemToParent,
    mapLocationLinkToParent,
    mapCodeActionToParent,
} from '../../lib/documents';
import { LSConfigManager, LSTypescriptConfig } from '../../ls-config';
import { pathToUrl } from '../../utils';
import { CreateDocument, getLanguageServiceForDocument } from './service';
import {
    convertRange,
    getCommitCharactersForScriptElement,
    getScriptKindFromAttributes,
    mapSeverity,
    scriptElementKindToCompletionItemKind,
    symbolKindFromString,
    findTsConfigPath,
    getScriptKindFromFileName,
} from './utils';
import { TypescriptDocument } from './TypescriptDocument';
import {
    CodeActionsProvider,
    DefinitionsProvider,
    DiagnosticsProvider,
    DocumentSymbolsProvider,
    HoverProvider,
    OnRegister,
    Resolvable,
    OnWatchFileChanges,
    CompletionsProvider,
    AppCompletionItem,
    AppCompletionList,
} from '../interfaces';
import { SnapshotManager } from './SnapshotManager';
import { DocumentSnapshot, INITIAL_VERSION } from './DocumentSnapshot';

export interface CompletionEntryWithIdentifer extends
    ts.CompletionEntry, TextDocumentIdentifier {
    position: Position;
}

export class TypeScriptPlugin
    implements
    OnRegister,
    DiagnosticsProvider,
    HoverProvider,
    DocumentSymbolsProvider,
    DefinitionsProvider,
    CodeActionsProvider,
    OnWatchFileChanges,
    CompletionsProvider<CompletionEntryWithIdentifer> {
    private configManager!: LSConfigManager;
    private createDocument!: CreateDocument;
    private documents = new Map<Document, TypescriptDocument>();

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
            return new TypescriptDocument(document);
        };
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const isTypescript =
            getScriptKindFromAttributes(tsDoc.getAttributes()) === ts.ScriptKind.TS;

        const diagnostics: ts.Diagnostic[] = [
            ...lang.getSyntacticDiagnostics(tsDoc.getFilePath()!),
            ...lang.getSuggestionDiagnostics(tsDoc.getFilePath()!),
            ...lang.getSemanticDiagnostics(tsDoc.getFilePath()!),
        ];

        return diagnostics
            .map(diagnostic => ({
                range: convertRange(tsDoc, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
            }))
            .map(diagnostic => mapDiagnosticToParent(tsDoc, diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const info = lang.getQuickInfoAtPosition(
            tsDoc.getFilePath()!,
            tsDoc.offsetAt(tsDoc.positionInFragment(position)),
        );
        if (!info) {
            return null;
        }
        const contents = ts.displayPartsToString(info.displayParts);
        return mapHoverToParent(tsDoc, {
            range: convertRange(tsDoc, info.textSpan),
            contents: { language: 'ts', value: contents },
        });
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const navTree = lang.getNavigationTree(tsDoc.getFilePath()!);

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
            .map(symbol => mapSymbolInformationToParent(tsDoc, symbol));

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
                            tsDoc.positionAt(start.start),
                            tsDoc.positionAt(end.start + end.length),
                        ),
                        tsDoc.getURL(),
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

    getCompletions(
        document: Document,
        position: Position,
        triggerCharacter?: string,
    ): AppCompletionList<CompletionEntryWithIdentifer> | null {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        // The language service throws an error if the character is not a valid trigger character.
        // Also, the completions are worse.
        // Therefore, only use the characters the typescript compiler treats as valid.
        const validTriggerCharacters = ['.', '"', "'", '`', '/', '@', '<', '#'];
        const validTriggerCharacter = triggerCharacter && validTriggerCharacters.includes(
            triggerCharacter,
        )
            ? triggerCharacter
            : undefined;
        const filePath = tsDoc.getFilePath();

        if (!filePath) {
            return null;
        }

        const completions = lang.getCompletionsAtPosition(
            filePath,
            tsDoc.offsetAt(tsDoc.positionInFragment(position)),
            {
                includeCompletionsForModuleExports: true,
                triggerCharacter: validTriggerCharacter as any,
            },
        );

        if (!completions) {
            return null;
        }

        const completionItems = completions.entries
            .map(comp => this.toCompletionItem(comp, tsDoc.uri, position))
            .map(comp => mapCompletionItemToParent(tsDoc, comp));

        return CompletionList.create(completionItems);
    }

    private toCompletionItem(
        comp: ts.CompletionEntry,
        uri: string,
        position: Position
    ): AppCompletionItem<CompletionEntryWithIdentifer> {
        const { source } = comp;
        const detail = source ? `Auto import from ${source}` : undefined;

        return {
            label: this.getCompletionLabel(comp),
            kind: scriptElementKindToCompletionItemKind(comp.kind),
            sortText: comp.sortText,
            commitCharacters: getCommitCharactersForScriptElement(comp.kind),
            preselect: comp.isRecommended,
            detail,
            // pass essential data for resolving completion
            data: {
                ...comp,
                uri,
                position
            }
        };
    }

    private codeActionChangeToTextEdit(
        tsDoc: TypescriptDocument,
        change: ts.FileTextChanges
    ): TextEdit[] {
        return change.textChanges.map(item => ({
            range: convertRange(tsDoc, item.span),
            newText: item.newText
        }));
    }

    private getCompletionLabel(comp: ts.CompletionEntry) {
        const { kind, kindModifiers, name } = comp;
        const isScriptElement = kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);

        if (isScriptElement && hasModifier) {
            return name + kindModifiers;
        }
        return name;
    }

    resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>):
        Resolvable<AppCompletionItem<CompletionEntryWithIdentifer>> {
        const { data: comp } = completionItem;
        const { tsDoc, lang } = this.getLSAndTSDoc(document);

        const filePath = tsDoc.getFilePath();

        if (!comp || !filePath) {
            return completionItem;
        }

        const detail = lang.getCompletionEntryDetails(
            filePath,
            tsDoc.offsetAt(tsDoc.positionInFragment(comp.position)),
            comp.name,
            {},
            comp.source,
            {}
        );

        const actions = detail?.codeActions;
        if (actions) {
            const edit: TextEdit[] = [];

            for (const action of actions) {
                for (const change of action.changes) {
                    edit.push(...this.codeActionChangeToTextEdit(tsDoc, change));
                }
            }

            completionItem.additionalTextEdits = edit;
        }

        return completionItem;
    }

    getDefinitions(document: Document, position: Position): DefinitionLink[] {
        if (!this.featureEnabled('definitions')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);

        const defs = lang.getDefinitionAndBoundSpan(
            tsDoc.getFilePath()!,
            tsDoc.offsetAt(tsDoc.positionInFragment(position)),
        );

        if (!defs || !defs.definitions) {
            return [];
        }

        const docs = new Map<string, Document>([[tsDoc.getFilePath()!, tsDoc]]);

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
                    convertRange(tsDoc, defs.textSpan),
                );
            })
            .filter(def => !!def)
            .map(def => mapLocationLinkToParent(tsDoc, def)) as DefinitionLink[];
    }

    getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Resolvable<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);

        const start = tsDoc.offsetAt(tsDoc.positionInFragment(range.start));
        const end = tsDoc.offsetAt(tsDoc.positionInFragment(range.end));
        const errorCodes: number[] = context.diagnostics.map(diag => Number(diag.code));
        const codeFixes = lang.getCodeFixesAtPosition(
            tsDoc.getFilePath()!,
            start,
            end,
            errorCodes,
            {},
            {},
        );

        const docs = new Map<string, Document>([[tsDoc.getFilePath()!, tsDoc]]);
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
            .map(fix => mapCodeActionToParent(tsDoc, fix));
    }

    onWatchFileChanges(fileName: string, changeType: FileChangeType) {
        const scriptKind = getScriptKindFromFileName(fileName);

        if (scriptKind === ts.ScriptKind.Unknown) {
            return;
        }

        const tsconfigPath = findTsConfigPath(fileName);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsconfigPath);

        if (changeType === FileChangeType.Deleted) {
            snapshotManager.delete(fileName);
            return;
        }

        const content = ts.sys.readFile(fileName) ?? '';
        const newSnapshot: DocumentSnapshot = {
            getLength: () => content.length,
            getText: (start, end) => content.substring(start, end),
            getChangeRange: () => undefined,
            // ensure it's greater than initial build
            version: INITIAL_VERSION + 1,
            scriptKind: getScriptKindFromFileName(fileName)
        };


        const previousSnapshot = snapshotManager.get(fileName);

        if (previousSnapshot) {
            newSnapshot.version = previousSnapshot.version + 1;
        }

        snapshotManager.set(fileName, newSnapshot);
    }

    private getLSAndTSDoc(document: Document) {
        let tsDoc = this.documents.get(document);
        if (!tsDoc) {
            tsDoc = new TypescriptDocument(document);
            this.documents.set(document, tsDoc);
        }

        const lang = getLanguageServiceForDocument(tsDoc, this.createDocument);

        return { tsDoc, lang };
    }

    private featureEnabled(feature: keyof LSTypescriptConfig) {
        return (
            this.configManager.enabled('typescript.enable') &&
            this.configManager.enabled(`typescript.${feature}.enable`)
        );
    }
}
