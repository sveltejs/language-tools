import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import type { Document } from '../lib/documents';
import { parseTemplateAst, TemplateAstWalker } from '../plugins/svelte/templateAst';
import type { TsApiAccess } from '../plugins/typescript-go/TsApiService';
import {
    TsgoDiagnosticCode,
    transformDiagnostics
} from '../plugins/typescript-go/middleware/diagnostics';
import {
    isInVirtualCode,
    relocateVirtualCodeDiagnostics
} from '../plugins/typescript-go/middleware/virtualCodeDiagnostics';
import { ApiDiagnostic, flattenMessage, toDiagnostic, toSeverity } from './convert';

/** Source of the content mapper's own diagnostics (svelte2tsx parse errors), see the mapper's `initialize` */
const MAPPER_DIAGNOSTIC_SOURCE = 'svelte';

const unknownRange = () => ({
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 }
});

export interface PostProcessOptions {
    /** `ts` or `js`, like TS6 svelte-check (see `getSvelteFileSource`) */
    source: 'ts' | 'js';
    /**
     * Keep the content mapper's parse errors. The middleware drops them because the Svelte
     * compiler reports the same error; without Svelte diagnostics they're the only report.
     */
    keepMapperDiagnostics: boolean;
}

/**
 * The TypeScript diagnostics of one Svelte file, post-processed with the same rules as the editor
 * middleware (`transformDiagnostics`), including the relocation of problems in unmapped virtual
 * code through the TS7 API (`relocateVirtualCodeDiagnostics`).
 *
 * The middleware works on TS7's LSP diagnostics, where all problems in unmapped virtual code are
 * folded into one diagnostic (18080) with the problems as related information. The API reports
 * them one by one (with an 18074 note), so they're folded the same way here before the
 * middleware runs, and whatever the middleware can't place is reported one by one again.
 */
export async function postProcessSvelteDiagnostics(
    document: Document,
    diagnostics: ApiDiagnostic[],
    api: TsApiAccess,
    options: PostProcessOptions
): Promise<Diagnostic[]> {
    const inVirtualCode = diagnostics.filter(isInVirtualCode);
    const mapped = diagnostics
        .filter((diagnostic) => !isInVirtualCode(diagnostic))
        .map((diagnostic) => toDiagnostic(diagnostic, diagnostic.source || options.source));

    let virtualCode: Awaited<ReturnType<typeof relocateVirtualCodeDiagnostics>> = undefined;
    if (inVirtualCode.length) {
        mapped.push(toVirtualCodeAggregate(document, inVirtualCode));
        virtualCode = await relocateVirtualCodeDiagnostics(
            api,
            document,
            await loadTemplateAst(document)
        );
    }

    const result: Diagnostic[] = [];
    for (const diagnostic of transformDiagnostics(mapped, { document, virtualCode })) {
        if (diagnostic.code === TsgoDiagnosticCode.VIRTUAL_CODE_PROBLEMS) {
            result.push(...expandVirtualCodeAggregate(diagnostic, inVirtualCode, options.source));
        } else {
            // relocated diagnostics are created with `ts`
            result.push({ ...diagnostic, source: options.source });
        }
    }

    if (options.keepMapperDiagnostics) {
        for (const diagnostic of diagnostics) {
            if (diagnostic.source === MAPPER_DIAGNOSTIC_SOURCE) {
                result.push(toDiagnostic(diagnostic, options.source));
            }
        }
    }
    return result;
}

/** Like TS7's LSP: the problems in unmapped virtual code, folded into one 18080 at the start */
function toVirtualCodeAggregate(document: Document, inVirtualCode: ApiDiagnostic[]): Diagnostic {
    return {
        range: unknownRange(),
        severity: DiagnosticSeverity.Error,
        source: 'ts',
        code: TsgoDiagnosticCode.VIRTUAL_CODE_PROBLEMS,
        message:
            'Virtual code produced by the content mapper has problems with no corresponding location in this file.',
        relatedInformation: inVirtualCode.map((diagnostic) => ({
            message: flattenMessage(diagnostic),
            location: { uri: document.uri, range: unknownRange() }
        }))
    };
}

/**
 * The problems the middleware couldn't place or drop. Reported at the start of the file, because
 * they have no location in it.
 */
function expandVirtualCodeAggregate(
    aggregate: Diagnostic,
    inVirtualCode: ApiDiagnostic[],
    source: string
): Diagnostic[] {
    const remaining = [...inVirtualCode];
    const result: Diagnostic[] = [];
    for (const info of aggregate.relatedInformation ?? []) {
        const index = remaining.findIndex(
            (diagnostic) => flattenMessage(diagnostic) === info.message
        );
        if (index === -1) {
            continue;
        }
        const [diagnostic] = remaining.splice(index, 1);
        result.push({
            range: unknownRange(),
            severity: toSeverity(diagnostic.category),
            source,
            code: diagnostic.code,
            message:
                info.message +
                '\n(in code generated for this Svelte file, without a corresponding location)',
            data: { positionUnknown: true }
        });
    }
    return result;
}

/** The template AST for the `bind:` relocation. svelte2tsx (and with it TS6) is loaded on demand */
async function loadTemplateAst(document: Document): Promise<TemplateAstWalker> {
    const { internalHelpers } = await import('svelte2tsx');
    return parseTemplateAst(document, internalHelpers.parseTemplateOnly);
}
