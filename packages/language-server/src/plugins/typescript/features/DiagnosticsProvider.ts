import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Document, mapDiagnosticToOriginal } from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange, mapSeverity } from '../utils';

export class DiagnosticsProviderImpl implements DiagnosticsProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
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
            .filter(hasNoNegativeLines)
            .filter(isNoFalsePositive);
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}

/**
 * In some rare cases mapping of diagnostics does not work and produces negative lines.
 * We filter out these diagnostics with negative lines because else the LSP
 * apparently has a hickup and does not show any diagnostics at all.
 */
function hasNoNegativeLines(diagnostic: Diagnostic): boolean {
    return diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0;
}

function isNoFalsePositive(diagnostic: Diagnostic): boolean {
    return (
        diagnostic.code !==
            17001 /* jsx cannot have multiple attributes with same name,
            but that's allowed for svelte */ &&
        (diagnostic.code !== 7028 ||
            diagnostic.range.end.character - 1 !== diagnostic.range.start.character)
        /* unused label warning when using reactive statement (`$: a = ...`) */
    );
}
