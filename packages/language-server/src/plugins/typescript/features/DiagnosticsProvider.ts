import ts from 'typescript';
import { CancellationToken, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Document, getTextInRange, isRangeInTag, mapRangeToOriginal } from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange, getDiagnosticTag, mapSeverity } from '../utils';
import { SvelteDocumentSnapshot, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { isInGeneratedCode, isAfterSvelte2TsxPropsReturn } from './utils';
import { regexIndexOf, swapRangeStartEndIfNecessary } from '../../../utils';

export class DiagnosticsProviderImpl implements DiagnosticsProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getDiagnostics(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);

        if (
            ['coffee', 'coffeescript'].includes(document.getLanguageAttribute('script')) ||
            cancellationToken?.isCancellationRequested
        ) {
            return [];
        }

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
            .filter(isNotGenerated(tsDoc.getText(0, tsDoc.getLength())))
            .map<Diagnostic>((diagnostic) => ({
                range: convertRange(tsDoc, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
                tags: getDiagnosticTag(diagnostic)
            }))
            .map(mapRange(fragment, document))
            .filter(hasNoNegativeLines)
            .filter(isNoFalsePositive(document, tsDoc))
            .map(enhanceIfNecessary)
            .map(swapDiagRangeStartEndIfNecessary);
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}

function mapRange(
    fragment: SvelteSnapshotFragment,
    document: Document
): (value: Diagnostic) => Diagnostic {
    return (diagnostic) => {
        let range = mapRangeToOriginal(fragment, diagnostic.range);

        if (range.start.line < 0) {
            const is$$PropsError =
                isAfterSvelte2TsxPropsReturn(
                    fragment.text,
                    fragment.offsetAt(diagnostic.range.start)
                ) && diagnostic.message.includes('$$Props');

            if (is$$PropsError) {
                const propsStart = regexIndexOf(
                    document.getText(),
                    /(interface|type)\s+\$\$Props[\s{=]/
                );

                if (propsStart) {
                    const start = document.positionAt(
                        propsStart + document.getText().substring(propsStart).indexOf('$$Props')
                    );
                    range = {
                        start,
                        end: { ...start, character: start.character + '$$Props'.length }
                    };
                }
            }
        }

        return { ...diagnostic, range };
    };
}

/**
 * In some rare cases mapping of diagnostics does not work and produces negative lines.
 * We filter out these diagnostics with negative lines because else the LSP
 * apparently has a hickup and does not show any diagnostics at all.
 */
function hasNoNegativeLines(diagnostic: Diagnostic): boolean {
    return diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0;
}

function isNoFalsePositive(document: Document, tsDoc: SvelteDocumentSnapshot) {
    const text = document.getText();
    const usesPug = document.getLanguageAttribute('template') === 'pug';

    return (diagnostic: Diagnostic) => {
        return (
            isNoJsxCannotHaveMultipleAttrsError(diagnostic) &&
            isNoUnusedLabelWarningForReactiveStatement(diagnostic) &&
            isNoUsedBeforeAssigned(diagnostic, text, tsDoc) &&
            (!usesPug || isNoPugFalsePositive(diagnostic, document))
        );
    };
}

/**
 * All diagnostics inside the template tag and the unused import/variable diagnostics
 * are marked as false positive.
 */
function isNoPugFalsePositive(diagnostic: Diagnostic, document: Document): boolean {
    return (
        !isRangeInTag(diagnostic.range, document.templateInfo) &&
        diagnostic.code !== 6133 &&
        diagnostic.code !== 6192
    );
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
                '  class ComponentName { $$prop_def: { propertyName: string; } }\n' +
                'If you are using Svelte 3.31+, use SvelteComponentTyped:\n' +
                '  import type { SvelteComponentTyped } from "svelte";\n' +
                '  class ComponentName extends SvelteComponentTyped<{propertyName: string;}> {}\n\n' +
                'Underlying error:\n' +
                diagnostic.message
        };
    }

    if (diagnostic.code === 2607) {
        return {
            ...diagnostic,
            message:
                'Element does not support attributes because ' +
                'type definitions are missing for this Svelte Component or element cannot be used as such.\n\n' +
                'Underlying error:\n' +
                diagnostic.message
        };
    }

    if (diagnostic.code === 1184) {
        return {
            ...diagnostic,
            message:
                diagnostic.message +
                '\nIf this is a declare statement, move it into <script context="module">..</script>'
        };
    }

    return diagnostic;
}

/**
 * Due to source mapping, some ranges may be swapped: Start is end. Swap back in this case.
 */
function swapDiagRangeStartEndIfNecessary(diag: Diagnostic): Diagnostic {
    diag.range = swapRangeStartEndIfNecessary(diag.range);
    return diag;
}

/**
 * Checks if diagnostic is not within a section that should be completely ignored
 * because it's purely generated.
 */
function isNotGenerated(text: string) {
    return (diagnostic: ts.Diagnostic) => {
        if (diagnostic.start === undefined || diagnostic.length === undefined) {
            return true;
        }
        return !isInGeneratedCode(text, diagnostic.start, diagnostic.start + diagnostic.length);
    };
}
