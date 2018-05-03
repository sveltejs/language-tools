import ts from 'typescript';
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
    FormattingProvider,
    TextEdit,
} from '../api';
import { convertRange, getScriptKindFromTypeAttribute } from './typescript/utils';
import { createLanguageService } from './typescript/service';

export class TypeScriptPlugin implements DiagnosticsProvider, HoverProvider, FormattingProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'script';
    }

    private lang = createLanguageService();

    getDiagnostics(document: Document): Diagnostic[] {
        const lang = this.lang.updateDocument(document);
        const syntaxDiagnostics = lang.getSyntacticDiagnostics(document.getFilePath()!);
        const semanticDiagnostics = lang.getSemanticDiagnostics(document.getFilePath()!);
        return [...syntaxDiagnostics, ...semanticDiagnostics].map(diagnostic => ({
            range: convertRange(document, diagnostic),
            severity: DiagnosticSeverity.Error,
            source:
                getScriptKindFromTypeAttribute(document.getAttributes().type) === ts.ScriptKind.TS
                    ? 'ts'
                    : 'js',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }));
    }

    doHover(document: Document, position: Position): Hover | null {
        const lang = this.lang.updateDocument(document);
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
            parser: getParserFromTypeAttribute(document.getAttributes().type),
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

function getParserFromTypeAttribute(type: string): prettier.BuiltInParserName {
    switch (type) {
        case 'text/typescript':
            return 'typescript';
        case 'text/javascript':
        default:
            return 'babylon';
    }
}
