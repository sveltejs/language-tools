import ts from 'typescript';
import { join, resolve, basename } from 'path';
import * as prettier from 'prettier';
import detectIndent from 'detect-indent';
import indentString from 'indent-string';
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
    MarkedString,
    FormattingProvider,
    TextEdit,
} from '../api';

const FILE_NAME = 'vscode://javascript/1';

export class TypeScriptPlugin implements DiagnosticsProvider, HoverProvider, FormattingProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'script';
    }

    private lang = getLanguageService();

    getDiagnostics(document: Document): Diagnostic[] {
        const lang = this.lang.withDocument(document);
        const syntaxDiagnostics = lang.getSyntacticDiagnostics(document.getFilePath()!);
        const semanticDiagnostics = lang.getSemanticDiagnostics(document.getFilePath()!);
        return [...syntaxDiagnostics, ...semanticDiagnostics].map(diagnostic => ({
            range: convertRange(document, diagnostic),
            severity: DiagnosticSeverity.Error,
            source: 'js',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }));
    }

    doHover(document: Document, position: Position): Hover | null {
        const lang = this.lang.withDocument(document);
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
        if (document.getTextLength() === 0) {
            return [];
        }

        const config = await prettier.resolveConfig(document.getFilePath()!);
        const formattedCode = prettier.format(document.getText(), {
            ...config,
            parser: 'typescript', // TODO: select babylon if js only
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
}

function generateComponentTypings(fileName: string) {
    const compName = basename(fileName, '.html.d.ts');
    // TODO: flesh out
    return `
        export interface ${compName}Data {
            // TODO
        }

        export default class ${compName} {
            constructor(opts: { target: Element, data: ${compName}Data });
        }
    `;
}

function getLanguageService() {
    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ES2015,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        strict: true,
    };
    let currentDocument: Document;
    const host: ts.LanguageServiceHost & ts.ModuleResolutionHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames() {
            const filePath = currentDocument.getFilePath()!;
            const fileInfo = ts.preProcessFile(currentDocument.getText(), true, true);
            const scripts = [
                filePath,
                filePath + '.d.ts',
                ...fileInfo.importedFiles
                    .map(file => {
                        return ts.resolveModuleName(file.fileName, filePath, compilerOptions, this)
                            .resolvedModule;
                    })
                    .filter(mod => !!mod)
                    .map(mod => mod!.resolvedFileName),
            ];
            return scripts;
        },
        getScriptVersion: (fileName: string) => {
            if (fileName === currentDocument.getFilePath()) {
                return String(currentDocument.version);
            }
            return '1';
        },
        getScriptSnapshot: (fileName: string) => {
            let text = '';
            if (fileName === currentDocument.getFilePath()) {
                text = currentDocument.getText();
            } else if (fileName.endsWith('.html.d.ts') && !ts.sys.fileExists(fileName)) {
                text = generateComponentTypings(fileName);
            } else {
                text = ts.sys.readFile(fileName) || '';
            }

            return ts.ScriptSnapshot.fromString(text);
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
        fileExists(fileName: string) {
            return (
                ts.sys.fileExists(fileName) ||
                (fileName.endsWith('.html.d.ts') &&
                    ts.sys.fileExists(fileName.slice(0, fileName.length - '.d.ts'.length)))
            );
        },
        readFile(fileName: string) {
            return ts.sys.readFile(fileName);
        },
    };
    const lang = ts.createLanguageService(host);

    return {
        withDocument(document: Document) {
            currentDocument = document;
            return lang;
        },
    };
}

function convertRange(document: Document, range: { start?: number; length?: number }) {
    return Range.create(
        document.positionAt(range.start || 0),
        document.positionAt((range.start || 0) + (range.length || 0)),
    );
}
