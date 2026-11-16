import { Diagnostic, DiagnosticSeverity, DiagnosticTag, Range } from 'vscode-languageserver';
import type { Document } from '../lib/documents';
import type { tsApiAsync } from '../plugins/typescript-go/types';

export type ApiDiagnostic = tsApiAsync.Diagnostic;

/** "This location is in virtual code produced by the content mapper ..." */
const IN_VIRTUAL_CODE = 18074;

const unknownRange: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

/**
 * A TS7 API diagnostic as svelte-check reports it. The API already maps diagnostics of
 * content-mapped files to the original file: `startPosition`/`endPosition` are lines and UTF-16
 * characters of the original text (except in unmapped virtual code, see `isInVirtualCode`).
 */
export function toDiagnostic(diagnostic: ApiDiagnostic, source: string | undefined): Diagnostic {
    const start = diagnostic.startPosition;
    const range = start
        ? { start, end: diagnostic.endPosition ?? start }
        : structuredClone(unknownRange);
    const result: Diagnostic = {
        range,
        severity: toSeverity(diagnostic.category),
        source,
        message: flattenMessage(diagnostic),
        code: diagnostic.code,
        tags: getTags(diagnostic)
    };
    return result;
}

/** Diagnostics of TS/JS files and of the tsconfig: like TS6 svelte-check, flag unknown positions */
export function toFileDiagnostic(diagnostic: ApiDiagnostic): Diagnostic {
    return {
        ...toDiagnostic(diagnostic, diagnostic.source || undefined),
        data: {
            positionUnknown:
                !diagnostic.fileName || !diagnostic.pos || diagnostic.pos === diagnostic.end
        }
    };
}

/** Like TS6's `flattenDiagnosticMessageText(_, '\n')`, without TS7's "in virtual code" notes */
export function flattenMessage(diagnostic: ApiDiagnostic, level = 0): string {
    let message = diagnostic.text;
    for (const chained of diagnostic.messageChain ?? []) {
        if (chained.code !== IN_VIRTUAL_CODE) {
            message += '\n' + '  '.repeat(level + 1) + flattenMessage(chained, level + 1);
        }
    }
    return message;
}

/** TS `DiagnosticCategory`: Warning, Error, Suggestion, Message */
export function toSeverity(category: number): DiagnosticSeverity {
    switch (category) {
        case 0:
            return DiagnosticSeverity.Warning;
        case 2:
            return DiagnosticSeverity.Hint;
        case 3:
            return DiagnosticSeverity.Information;
        default:
            return DiagnosticSeverity.Error;
    }
}

function getTags(diagnostic: ApiDiagnostic): DiagnosticTag[] {
    const tags: DiagnosticTag[] = [];
    if (diagnostic.reportsUnnecessary) {
        tags.push(DiagnosticTag.Unnecessary);
    }
    if (diagnostic.reportsDeprecated) {
        tags.push(DiagnosticTag.Deprecated);
    }
    return tags;
}

/**
 * The `source` TS6 svelte-check reports for TypeScript diagnostics of a Svelte file: `ts` if a
 * script is TypeScript, `js` otherwise (`getScriptKindFromAttributes`)
 */
export function getSvelteFileSource(document: Document): 'ts' | 'js' {
    return [document.scriptInfo?.attributes, document.moduleScriptInfo?.attributes].some(
        isTypeScriptScript
    )
        ? 'ts'
        : 'js';
}

function isTypeScriptScript(attributes: Record<string, string> | undefined) {
    const type = attributes?.lang || attributes?.type;
    return (
        type === 'ts' || type === 'typescript' || type === 'text/ts' || type === 'text/typescript'
    );
}
