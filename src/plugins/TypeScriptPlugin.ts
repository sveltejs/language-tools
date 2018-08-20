import ts, { NavigationTree } from 'typescript';
import * as prettier from 'prettier';
import detectIndent from 'detect-indent';
import indentString from 'indent-string';
import URL from 'vscode-uri';
import {
    DiagnosticsProvider,
    Document,
    Diagnostic,
    Range,
    DiagnosticSeverity,
    Fragment,
    HoverProvider,
    Position,
    Hover,
    FormattingProvider,
    TextEdit,
    OnRegister,
    Host,
    DocumentSymbolsProvider,
    SymbolInformation,
    SymbolKind,
} from '../api';
import {
    convertRange,
    getScriptKindFromAttributes,
    symbolKindFromString,
} from './typescript/utils';
import { getLanguageServiceForDocument, CreateDocument } from './typescript/service';

export class TypeScriptPlugin
    implements
        DiagnosticsProvider,
        HoverProvider,
        FormattingProvider,
        OnRegister,
        DocumentSymbolsProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'script';
    }

    public pluginId = 'typescript';
    public defaultConfig = {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        format: { enable: true },
    };

    private host!: Host;
    private createDocument!: CreateDocument;

    onRegister(host: Host) {
        this.host = host;
        this.createDocument = (fileName, content) => {
            const uri = URL.file(fileName).toString();
            const document = host.openDocument({
                languageId: '',
                text: content,
                uri,
                version: 1,
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
        const syntaxDiagnostics = lang.getSyntacticDiagnostics(document.getFilePath()!);
        const semanticDiagnostics = lang.getSemanticDiagnostics(document.getFilePath()!);
        return [...syntaxDiagnostics, ...semanticDiagnostics].map(diagnostic => ({
            range: convertRange(document, diagnostic),
            severity: DiagnosticSeverity.Error,
            source:
                getScriptKindFromAttributes(document.getAttributes()) === ts.ScriptKind.TS
                    ? 'ts'
                    : 'js',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }));
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

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (!this.host.getConfig<boolean>('typescript.format.enable')) {
            return [];
        }

        if (document.getTextLength() === 0) {
            return [];
        }

        const config = await prettier.resolveConfig(document.getFilePath()!);
        const formattedCode = prettier.format(document.getText(), {
            ...config,
            parser: getParserFromAttributes(document.getAttributes()),
        });

        let indent = detectIndent(document.getText());
        return [
            TextEdit.replace(
                Range.create(document.positionAt(0), document.positionAt(document.getTextLength())),
                '\n' +
                    indentString(formattedCode, indent.amount, indent.type == 'tab' ? '\t' : ' '),
            ),
        ];
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.host.getConfig<boolean>('typescript.documentSymbols.enable')) {
            return [];
        }

        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const navTree = lang.getNavigationTree(document.getFilePath()!);

        const symbols: SymbolInformation[] = [];
        collectSymbols(navTree, undefined, symbol => symbols.push(symbol));

        return symbols.slice(1);

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
}

function getParserFromAttributes(attrs: Record<string, string>): prettier.BuiltInParserName {
    const type = attrs.lang || attrs.type;

    switch (type) {
        case 'typescript':
        case 'text/typescript':
            return 'typescript';
        case 'javascript':
        case 'text/javascript':
        default:
            return 'babylon';
    }
}
