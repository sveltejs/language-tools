import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver';
import { Document, mapObjWithRangeToOriginal, getTextInRange } from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange, mapSeverity } from '../utils';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';

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
                    code: tsDoc.parserError.code
                }
            ];
        }

        const diagnostics: ts.Diagnostic[] = [
            ...lang.getSyntacticDiagnostics(tsDoc.filePath),
            ...lang.getSuggestionDiagnostics(tsDoc.filePath),
            ...lang.getSemanticDiagnostics(tsDoc.filePath)
        ];

        const fragment = await tsDoc.getFragment();

        return diagnostics
            .map<Diagnostic>((diagnostic) => ({
                range: convertRange(tsDoc, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
                tags: this.getDiagnosticTag(diagnostic)
            }))
            .map((diagnostic) => mapObjWithRangeToOriginal(fragment, diagnostic))
            .filter(hasNoNegativeLines)
            .filter(isNoFalsePositive(document.getText(), tsDoc, diagnostics))
            .map(enhanceIfNecessary)
            .map(swapRangeStartEndIfNecessary);
    }

    private getDiagnosticTag(diagnostic: ts.Diagnostic) {
        const tags: DiagnosticTag[] = [];
        if (diagnostic.reportsUnnecessary) {
            tags.push(DiagnosticTag.Unnecessary);
        }
        if (diagnostic.reportsDeprecated) {
            tags.push(DiagnosticTag.Deprecated);
        }
        return tags;
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

function isNoFalsePositive(
    text: string,
    tsDoc: SvelteDocumentSnapshot,
    rawTsDiagnostics: ts.Diagnostic[]
) {
    return (diagnostic: Diagnostic, idx: number) => {
        return (
            isNoJsxCannotHaveMultipleAttrsError(diagnostic) &&
            isNoUnusedLabelWarningForReactiveStatement(diagnostic) &&
            isNoUsedBeforeAssigned(diagnostic, text, tsDoc) &&
            isNotHiddenStoreValueDeclaration(diagnostic, tsDoc, rawTsDiagnostics[idx])
        );
    };
}

/**
 * During compilation to tsx, for each store we create an additional variable
 * called `$<store-name>` which contains the store value.
 * This variable declaration does not show up in the sourcemaps.
 * We have to ignore the error if the variable prefixed by `$` was not a store.
 */
function isNotHiddenStoreValueDeclaration(
    diagnostic: Diagnostic,
    tsDoc: SvelteDocumentSnapshot,
    rawTsDiagnostic: ts.Diagnostic
): boolean {
    if (diagnostic.code !== 2345 || !rawTsDiagnostic.start) return true;

    const affectedLine = tsDoc.getLineContainingOffset(rawTsDiagnostic.start);
    const hasStoreValueDefinition = /let \$[\w$]+ = __sveltets_store_get\(/.test(affectedLine);

    return !hasStoreValueDefinition;
}

/**
 * Variable used before being assigned, can happen when  you do `export let x`
 * without assigning a value in strict mode. Should not throw an error here
 * but on the component-user-side ("you did not set a required prop").
 */
function isNoUsedBeforeAssigned(
    diagnostic: Diagnostic,
    text: string,
    tsDoc: SvelteDocumentSnapshot
): boolean {
    if (diagnostic.code !== 2454) {
        return true;
    }

    return !tsDoc.hasProp(getTextInRange(diagnostic.range, text));
}

/**
 * Unused label warning when using reactive statement (`$: a = ...`)
 */
function isNoUnusedLabelWarningForReactiveStatement(diagnostic: Diagnostic) {
    return (
        diagnostic.code !== 7028 ||
        diagnostic.range.end.character - 1 !== diagnostic.range.start.character
    );
}

/**
 * Jsx cannot have multiple attributes with same name,
 * but that's allowed for svelte
 */
function isNoJsxCannotHaveMultipleAttrsError(diagnostic: Diagnostic) {
    return diagnostic.code !== 17001;
}

/**
 * Some diagnostics have JSX-specific nomenclature. Enhance them for more clarity.
 */
function enhanceIfNecessary(diagnostic: Diagnostic): Diagnostic {
    if (diagnostic.code === 2786) {
        return {
            ...diagnostic,
            message:
                'Type definitions are missing for this Svelte Component. ' +
                // eslint-disable-next-line max-len
                "It needs a class definition with at least the property '$$prop_def' which should contain a map of input property definitions.\n" +
                'Example:\n' +
                'class ComponentName { $$prop_def: { propertyName: string; } }\n\n' +
                diagnostic.message
        };
    }

    return diagnostic;
}

/**
 * Due to source mapping, some ranges may be swapped: Start is end. Swap back in this case.
 */
function swapRangeStartEndIfNecessary(diag: Diagnostic): Diagnostic {
    if (
        diag.range.end.line < diag.range.start.line ||
        (diag.range.end.line === diag.range.start.line &&
            diag.range.end.character < diag.range.start.character)
    ) {
        const start = diag.range.start;
        diag.range.start = diag.range.end;
        diag.range.end = start;
    }
    return diag;
}
