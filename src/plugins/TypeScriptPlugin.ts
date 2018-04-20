import * as ts from 'typescript';
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
} from '../api';
import { join } from 'path';

const FILE_NAME = 'vscode://javascript/1';

export class TypeScriptPlugin implements DiagnosticsProvider, HoverProvider {
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
}

function getLanguageService() {
    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        lib: ['lib.es6.d.ts'],
        target: ts.ScriptTarget.Latest,
        moduleResolution: ts.ModuleResolutionKind.Classic,
    };
    let currentDocument: Document;
    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => {
            const filePath = currentDocument.getFilePath()!;
            return [filePath];
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
            } else {
                text = ts.sys.readFile(fileName) || '';
            }

            return ts.ScriptSnapshot.fromString(text);
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
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
