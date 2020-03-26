import ts, { NavigationTree } from 'typescript';
import {
    DiagnosticsProvider,
    Document,
    Diagnostic,
    Range,
    Fragment,
    HoverProvider,
    Position,
    Hover,
    OnRegister,
    Host,
    DocumentSymbolsProvider,
    SymbolInformation,
    CompletionsProvider,
    CompletionItem,
    DefinitionsProvider,
    DefinitionLink,
    LocationLink,
    CodeActionsProvider,
    CodeAction,
    Resolvable,
    CodeActionContext,
    TextEdit,
    TextDocumentEdit,
    VersionedTextDocumentIdentifier,
    CompletionList,
} from '../api';
import {
    convertRange,
    getScriptKindFromAttributes,
    symbolKindFromString,
    scriptElementKindToCompletionItemKind,
    getCommitCharactersForScriptElement,
    mapSeverity,
} from './typescript/utils';
import { getLanguageServiceForDocument, CreateDocument } from './typescript/service';
import { pathToUrl, isValidSvelteReactiveValueDiagnostic } from '../utils';
import { TextDocument } from '../lib/documents/TextDocument';

export class TypeScriptPlugin
    implements
        DiagnosticsProvider,
        HoverProvider,
        OnRegister,
        DocumentSymbolsProvider,
        CompletionsProvider,
        DefinitionsProvider,
        CodeActionsProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'script';
    }

    public pluginId = 'typescript';
    public defaultConfig = {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        definitions: { enable: true },
        documentSymbols: { enable: true },
    };

    private host!: Host;
    private createDocument!: CreateDocument;

    onRegister(host: Host) {
        this.host = host;
        this.createDocument = (fileName, content) => {
            const uri = pathToUrl(fileName);
            const document = host.openDocument({
                languageId: '',
                text: content,
                uri,
                version: 0,
            });
            host.lockDocument(uri);
            return document;
        };
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.host.getConfig<boolean>('typescript.diagnostics.enable')) {
            return [];
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const isTypescript =
            getScriptKindFromAttributes(document.getAttributes()) === ts.ScriptKind.TS;

        let diagnostics: ts.Diagnostic[] = [
            ...lang.getSyntacticDiagnostics(document.getFilePath()!),
            ...lang.getSuggestionDiagnostics(document.getFilePath()!),
        ];

        if (isTypescript) {
            diagnostics.push(...lang.getSemanticDiagnostics(document.getFilePath()!));
        }

        return diagnostics.map(diagnostic => ({
            range: convertRange(document, diagnostic),
            severity: mapSeverity(diagnostic.category),
            source: isTypescript ? 'ts' : 'js',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            code: diagnostic.code,
        })).filter(diagnostic => isValidSvelteReactiveValueDiagnostic(diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.host.getConfig<boolean>('typescript.hover.enable')) {
            return null;
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const info = lang.getQuickInfoAtPosition(
            document.getFilePath()!,
            document.offsetAt(position),
        );
        if (!info) {
            return null;
        }
        let contents = ts.displayPartsToString(info.displayParts);
        return {
            range: convertRange(document, info.textSpan),
            contents: { language: 'ts', value: contents },
        };
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.host.getConfig<boolean>('typescript.documentSymbols.enable')) {
            return [];
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const navTree = lang.getNavigationTree(document.getFilePath()!);

        const symbols: SymbolInformation[] = [];
        collectSymbols(navTree, undefined, symbol => symbols.push(symbol));

        const topContainerName = symbols[0].name;
        return symbols.slice(1).map(symbol => {
            if (symbol.containerName === topContainerName) {
                return { ...symbol, containerName: 'script' };
            }

            return symbol;
        });

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
                            document.positionAt(start.start),
                            document.positionAt(end.start + end.length),
                        ),
                        document.getURL(),
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
    ): CompletionList | null {
        if (!this.host.getConfig<boolean>('typescript.completions.enable')) {
            return null;
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);
        // The language service throws an error if the character is not a valid trigger character.
        // Also, the completions are worse.
        // Therefore, only use the characters the typescript compiler treats as valid.
        const validTriggerCharacter = ['.', '"', "'", '`', '/', '@', '<', '#'].includes(
            triggerCharacter!,
        )
            ? triggerCharacter
            : undefined;
        const completions = lang.getCompletionsAtPosition(
            document.getFilePath()!,
            document.offsetAt(position),
            {
                includeCompletionsForModuleExports: true,
                triggerCharacter: validTriggerCharacter as any,
            },
        );

        if (!completions) {
            return null;
        }

        return CompletionList.create(
            completions!.entries.map(comp => {
                return <CompletionItem>{
                    label: comp.name,
                    kind: scriptElementKindToCompletionItemKind(comp.kind),
                    sortText: comp.sortText,
                    commitCharacters: getCommitCharactersForScriptElement(comp.kind),
                    preselect: comp.isRecommended,
                };
            }),
        );
    }

    getDefinitions(document: Document, position: Position): DefinitionLink[] {
        if (!this.host.getConfig<boolean>('typescript.definitions.enable')) {
            return [];
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);

        const defs = lang.getDefinitionAndBoundSpan(
            document.getFilePath()!,
            document.offsetAt(position),
        );

        if (!defs || !defs.definitions) {
            return [];
        }

        const docs = new Map<string, Document>([[document.getFilePath()!, document]]);

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
                    convertRange(document, defs.textSpan),
                );
            })
            .filter(res => !!res) as DefinitionLink[];
    }

    getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Resolvable<CodeAction[]> {
        if (!this.host.getConfig<boolean>('typescript.codeActions.enable')) {
            return [];
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);

        const start = document.offsetAt(range.start);
        const end = document.offsetAt(range.end);
        const errorCodes: number[] = context.diagnostics.map(diag => Number(diag.code));
        const codeFixes = lang.getCodeFixesAtPosition(
            document.getFilePath()!,
            start,
            end,
            errorCodes,
            {},
            {},
        );

        const docs = new Map<string, Document>([[document.getFilePath()!, document]]);
        return codeFixes.map(fix => {
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
        });
    }
}
