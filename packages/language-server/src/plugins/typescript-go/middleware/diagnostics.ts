import { Diagnostic, DocumentDiagnosticReport } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { isRangeInTag } from '../../../lib/documents/utils';
import type { SvelteNode } from '../../svelte/features/svelte-ast-utils';
import type { TemplateAstWalker } from '../../svelte/TemplateASTLoader';
import { replaceGeneratedNames } from './generatedNames';
import type { VirtualCodeRelocation } from './virtualCodeDiagnostics';

/**
 * Post-processing of TypeScript 7 diagnostics for Svelte files in content mapper mode.
 *
 * TS7 already maps diagnostics back to the `.svelte` file, so unlike the TS6 path we never see
 * the svelte2tsx output here. Everything below works on original-file positions + document text
 * (+ the template AST). The exception are problems in unmapped virtual code, which are placed with
 * the TS7 API beforehand (`virtualCodeDiagnostics.ts`). Other rules that need the virtual code or the
 * type checker have to move into svelte2tsx / the content mapper.
 */

export const enum TsgoDiagnosticCode {
    MULTIPLE_PROPS_SAME_NAME = 1117,
    MODIFIERS_CANNOT_APPEAR_HERE = 1184,
    DUPLICATE_IDENTIFIER = 2300,
    TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2322,
    ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2345,
    NOOP_IN_COMMAS = 2695,
    NO_OVERLOAD_MATCHES_CALL = 2769,
    NEVER_READ = 6133,
    ALL_IMPORTS_UNUSED = 6192,
    DEPRECATED = 6385,
    DEPRECATED_SIGNATURE = 6387,
    UNUSED_LABEL = 7028,
    /** "This location is in virtual code produced by the content mapper ... " */
    IN_VIRTUAL_CODE = 18074,
    /** "Virtual code produced by the content mapper '...' has problems with no corresponding location in this file." */
    VIRTUAL_CODE_PROBLEMS = 18080
}

/** "declared but never read" & friends. Meaningless if the template couldn't be transformed. */
const UNUSED_CODES = new Set([6133, 6138, 6192, 6196, 6198, 6199, 6205]);

/** The content mapper reports svelte2tsx parse failures with this source (see `diagnosticSource` in the mapper). */
const MAPPER_DIAGNOSTIC_SOURCE = 'svelte';

const generatedVarRegex = /'\$\$_\w+(\.\$on)?'/;

/** Elements in the sense of TS6's `isAttributeName(node, 'Element')` / `isEventHandler(node, 'Element')` */
const ELEMENT_LIKE_TYPES = new Set(['Element', 'Body', 'Window']);

export interface TsgoDiagnosticsContext {
    document: Document;
    /** The problems of the virtual code diagnostic (18080) that could be placed, if any */
    virtualCode?: VirtualCodeRelocation;
    /** Only called when a rule needs the template AST */
    getTemplateAst?: () => TemplateAstWalker;
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
    { document, virtualCode, getTemplateAst }: TsgoDiagnosticsContext
): Diagnostic[] {
    // Like TS6: scripts in other languages aren't type checked
    if (['coffee', 'coffeescript'].includes(document.getLanguageAttribute('script'))) {
        return [];
    }
    const text = document.getText();
    const usesPug = document.getLanguageAttribute('template') === 'pug';
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
        if (usesPug && isPugFalsePositive(diagnostic, document)) {
            continue;
        }
        if (isDuplicateElementAttribute(diagnostic, document, getTemplateAst)) {
            continue;
        }
        if (diagnostic.code === TsgoDiagnosticCode.VIRTUAL_CODE_PROBLEMS) {
            result.push(...resolveVirtualCodeDiagnostic(diagnostic, virtualCode));
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
 * Svelte 5: `$on` and the class constructor are deprecated, but the generated code uses them.
 * The ones in unmapped virtual code are part of 18080, they are dropped in `virtualCodeDiagnostics.ts`.
 */
function isGeneratedDeprecation(diagnostic: Diagnostic) {
    return (
        diagnostic.code === TsgoDiagnosticCode.DEPRECATED_SIGNATURE &&
        generatedVarRegex.test(diagnostic.message)
    );
}

/**
 * Like TS6: svelte2tsx generates no template code for pug, so everything in the template and the
 * "unused" hints are false positives.
 */
function isPugFalsePositive(diagnostic: Diagnostic, document: Document) {
    return (
        isRangeInTag(diagnostic.range, document.templateInfo) ||
        diagnostic.code === TsgoDiagnosticCode.NEVER_READ ||
        diagnostic.code === TsgoDiagnosticCode.ALL_IMPORTS_UNUSED
    );
}

/**
 * Like TS6: duplicate attributes and event handlers on elements are fine in Svelte (e.g. two
 * `on:click`), but svelte2tsx turns them into properties of the same object literal.
 */
function isDuplicateElementAttribute(
    diagnostic: Diagnostic,
    document: Document,
    getTemplateAst: (() => TemplateAstWalker) | undefined
) {
    if (
        diagnostic.code !== TsgoDiagnosticCode.MULTIPLE_PROPS_SAME_NAME &&
        diagnostic.code !== TsgoDiagnosticCode.DUPLICATE_IDENTIFIER
    ) {
        return false;
    }
    const ast = getTemplateAst?.();
    if (!ast || ast.parserError) {
        return false;
    }
    const found = findTemplateNodeAt(ast, document.offsetAt(diagnostic.range.start));
    return (
        !!found &&
        (found.node.type === 'Attribute' || found.node.type === 'EventHandler') &&
        ELEMENT_LIKE_TYPES.has(found.parent?.type ?? '')
    );
}

/** The innermost template node at the offset, like TS6's `svelteNodeAt` */
function findTemplateNodeAt(ast: TemplateAstWalker, offset: number) {
    let found: { node: SvelteNode; parent: SvelteNode | undefined } | undefined;
    ast.walkSvelteAst({
        enter(node, parent) {
            if (node.start > offset || node.end < offset) {
                this.skip();
                return;
            }
            found = { node, parent };
        }
    });
    return found;
}

/**
 * TS7 collects all problems inside unmapped virtual code into a single diagnostic at the start of
 * the file, with the actual problems as related information (if the client supports it, positions
 * are unmapped). Replace the ones placed or dropped through the TS7 API (`virtualCodeDiagnostics.ts`).
 */
function resolveVirtualCodeDiagnostic(
    diagnostic: Diagnostic,
    virtualCode: VirtualCodeRelocation | undefined
): Diagnostic[] {
    if (!virtualCode?.handledMessages.length) {
        return [diagnostic];
    }
    if (virtualCode.complete) {
        return virtualCode.diagnostics;
    }

    const remaining = [...(diagnostic.relatedInformation ?? [])];
    for (const message of virtualCode.handledMessages) {
        const index = remaining.findIndex((info) => info.message.startsWith(message));
        if (index !== -1) {
            remaining.splice(index, 1);
        }
    }
    return [
        ...virtualCode.diagnostics,
        diagnostic.relatedInformation
            ? { ...diagnostic, relatedInformation: remaining }
            : diagnostic
    ];
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
