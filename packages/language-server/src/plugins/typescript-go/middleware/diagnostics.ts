import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DocumentDiagnosticReport,
    Range
} from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { TemplateAstWalker } from '../../svelte/TemplateASTLoader';
import { replaceGeneratedNames } from './generatedNames';

/**
 * Post-processing of TypeScript 7 diagnostics for Svelte files in content mapper mode.
 *
 * TS7 already maps diagnostics back to the `.svelte` file, so unlike the TS6 path we never see
 * the svelte2tsx output here. Everything below works on original-file positions + document text
 * (+ the template AST). Rules that need the virtual code or the type checker can't be ported
 * this way and have to move into svelte2tsx / the content mapper instead.
 */

export const enum TsgoDiagnosticCode {
    MODIFIERS_CANNOT_APPEAR_HERE = 1184,
    TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2322,
    ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2345,
    NOOP_IN_COMMAS = 2695,
    DEPRECATED_SIGNATURE = 6387,
    UNUSED_LABEL = 7028,
    /** "Virtual code produced by the content mapper '...' has problems with no corresponding location in this file." */
    VIRTUAL_CODE_PROBLEMS = 18080
}

/** "declared but never read" & friends. Meaningless if the template couldn't be transformed. */
const UNUSED_CODES = new Set([6133, 6138, 6192, 6196, 6198, 6199, 6205]);

/** The content mapper reports svelte2tsx parse failures with this source (see `diagnosticSource` in the mapper). */
const MAPPER_DIAGNOSTIC_SOURCE = 'svelte';

const generatedVarRegex = /'\$\$_\w+(\.\$on)?'/;
const nonBindableRegex = /^Type '"([\w$]+)"' is not assignable to type '[^']*'\.?$/;

export interface TsgoDiagnosticsContext {
    document: Document;
    /** Template-only AST. Undefined if it couldn't be loaded */
    ast: TemplateAstWalker | undefined;
}

export function transformDiagnosticReport(
    report: DocumentDiagnosticReport,
    context: TsgoDiagnosticsContext
): DocumentDiagnosticReport {
    if (report.kind !== 'full') {
        // 'unchanged': VS Code keeps the items from the last (already transformed) full report
        return report;
    }
    return { ...report, items: transformDiagnostics(report.items, context) };
}

export function transformDiagnostics(
    items: Diagnostic[],
    { document, ast }: TsgoDiagnosticsContext
): Diagnostic[] {
    const text = document.getText();
    // svelte2tsx failed -> the mapper only returned the script contents. Template usages are unknown,
    // so all "unused" hints are false positives. The parse error itself is already reported by the
    // Svelte plugin (svelte compiler diagnostics), so drop the duplicate, too.
    const mapperParseFailed = items.some(isMapperDiagnostic);

    const result: Diagnostic[] = [];
    for (const diagnostic of items) {
        if (isMapperDiagnostic(diagnostic)) {
            continue;
        }
        if (mapperParseFailed && UNUSED_CODES.has(diagnostic.code as number)) {
            continue;
        }
        if (isReactiveStatementLabel(diagnostic, document, text)) {
            continue;
        }
        if (isNoopInReactiveStatement(diagnostic, document, text)) {
            continue;
        }
        if (isGeneratedDeprecation(diagnostic)) {
            continue;
        }
        if (diagnostic.code === TsgoDiagnosticCode.VIRTUAL_CODE_PROBLEMS) {
            result.push(...resolveVirtualCodeDiagnostic(diagnostic, document, ast));
            continue;
        }
        result.push(adjustMessage(diagnostic, document.isSvelte5));
    }

    return dedupe(result.map(replaceGeneratedNamesInMessages));
}

function replaceGeneratedNamesInMessages(diagnostic: Diagnostic): Diagnostic {
    const result = { ...diagnostic, message: replaceGeneratedNames(diagnostic.message) };
    if (diagnostic.relatedInformation) {
        result.relatedInformation = diagnostic.relatedInformation.map((info) => ({
            ...info,
            message: replaceGeneratedNames(info.message)
        }));
    }
    return result;
}

function isMapperDiagnostic(diagnostic: Diagnostic) {
    return diagnostic.source === MAPPER_DIAGNOSTIC_SOURCE;
}

/**
 * `$: foo` is a label named `$` -> TS says "Unused label."
 */
function isReactiveStatementLabel(diagnostic: Diagnostic, document: Document, text: string) {
    if (diagnostic.code !== TsgoDiagnosticCode.UNUSED_LABEL) {
        return false;
    }
    const start = document.offsetAt(diagnostic.range.start);
    const end = document.offsetAt(diagnostic.range.end);
    return text.slice(start, end) === '$' && /^\s*:/.test(text.slice(end, end + 20));
}

/**
 * `$: a, b, c` lists dependencies, the comma expressions are intentional.
 *
 * Deviation from TS6: there we only ignored identifiers that are `let` variables (via
 * `getDefinitionAtPosition`) and re-reported the others. Without type information we drop all of
 * them inside `$:` statements.
 */
function isNoopInReactiveStatement(diagnostic: Diagnostic, document: Document, text: string) {
    if (diagnostic.code !== TsgoDiagnosticCode.NOOP_IN_COMMAS) {
        return false;
    }
    const lineStart = document.offsetAt({ line: diagnostic.range.start.line, character: 0 });
    const start = document.offsetAt(diagnostic.range.start);
    return /^\s*\$:/.test(text.slice(lineStart, start));
}

/**
 * Svelte 5: `$on` and the class constructor are deprecated, but the generated code uses them
 */
function isGeneratedDeprecation(diagnostic: Diagnostic) {
    return (
        diagnostic.code === TsgoDiagnosticCode.DEPRECATED_SIGNATURE &&
        generatedVarRegex.test(diagnostic.message)
    );
}

/**
 * TS7 collects all problems inside unmapped virtual code into a single diagnostic at the start of
 * the file, with the actual problems as related information (positions are also unmapped).
 *
 * We try to relocate the ones we can recognize from their message. That's heuristic - the proper
 * fix is to map these spans in svelte2tsx (e.g. map `$$bindings` to the `bind:` directive).
 */
function resolveVirtualCodeDiagnostic(
    diagnostic: Diagnostic,
    document: Document,
    ast: TemplateAstWalker | undefined
): Diagnostic[] {
    const related = diagnostic.relatedInformation ?? [];
    const remaining: DiagnosticRelatedInformation[] = [];
    const relocated: Diagnostic[] = [];

    for (const info of related) {
        const binding = relocateNonBindableError(info, document, ast);
        if (binding) {
            relocated.push({ ...diagnostic, ...binding, relatedInformation: undefined });
        } else {
            remaining.push(info);
        }
    }

    if (related.length && !remaining.length) {
        return relocated;
    }
    return [...relocated, { ...diagnostic, relatedInformation: remaining }];
}

/**
 * Port of TS6's `moveBindingErrorMessage`: `bind:x` on a component prop that isn't `$bindable()`.
 * In TS6 the error was on `$$bindings` in the generated code. TS7 can't map that, so we only get
 * the message. Relocate it if exactly one component binding with that name exists.
 */
function relocateNonBindableError(
    info: DiagnosticRelatedInformation,
    document: Document,
    ast: TemplateAstWalker | undefined
): Pick<Diagnostic, 'range' | 'message'> | undefined {
    const match = nonBindableRegex.exec(info.message);
    if (!match || !ast || ast.parserError) {
        return;
    }
    const name = match[1];

    const candidates: Array<{ start: number; end: number }> = [];
    ast.walkSvelteAst({
        enter(node, parent) {
            if (
                node.type === 'Binding' &&
                (node as any).name === name &&
                parent?.type === 'InlineComponent'
            ) {
                candidates.push(node as any);
            }
        }
    });
    if (candidates.length !== 1) {
        return;
    }

    return {
        range: Range.create(
            document.positionAt(candidates[0].start),
            document.positionAt(candidates[0].end)
        ),
        message:
            "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
            `To mark a property as bindable: 'let { ${name} = $bindable() } = $props()'`
    };
}

/**
 * Port of TS6's `adjustIfNecessary`
 */
function adjustMessage(diagnostic: Diagnostic, isSvelte5Plus: boolean): Diagnostic {
    if (
        diagnostic.code === TsgoDiagnosticCode.ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y &&
        diagnostic.message.includes('ConstructorOfATypedSvelteComponent')
    ) {
        return {
            ...diagnostic,
            message:
                diagnostic.message +
                '\n\nPossible causes:\n' +
                '- You use the instance type of a component where you should use the constructor type\n' +
                '- Type definitions are missing for this Svelte Component. ' +
                (isSvelte5Plus
                    ? ''
                    : 'If you are using Svelte 3.31+, use SvelteComponentTyped to add a definition:\n' +
                      '  import type { SvelteComponentTyped } from "svelte";\n' +
                      '  class ComponentName extends SvelteComponentTyped<{propertyName: string;}> {}')
        };
    }

    if (diagnostic.code === TsgoDiagnosticCode.MODIFIERS_CANNOT_APPEAR_HERE) {
        return {
            ...diagnostic,
            message:
                diagnostic.message +
                '\nIf this is a declare statement, move it into <script context="module">..</script>'
        };
    }

    return diagnostic;
}

function dedupe(diagnostics: Diagnostic[]) {
    const seen = new Set<string>();
    return diagnostics.filter((diagnostic) => {
        const key = JSON.stringify([
            diagnostic.range,
            diagnostic.code,
            diagnostic.severity,
            diagnostic.message
        ]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
