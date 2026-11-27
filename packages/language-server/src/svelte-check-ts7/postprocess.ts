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
import {
    addUnresolvedSvelteImports,
    findUnresolvedSvelteImports
} from '../plugins/typescript-go/middleware/unresolvedSvelteImports';
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
    /**
     * Also report imports of `.svelte` files that don't exist (see `withUnresolvedSvelteImports`).
     * Only if the program got to the semantic check.
     */
    unresolvedSvelteImports: boolean;
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

    const withImports = options.unresolvedSvelteImports
        ? await withUnresolvedSvelteImports(
              result,
              api,
              document.uri,
              document.getText(),
              options.source
          )
        : result;

    if (options.keepMapperDiagnostics) {
        for (const diagnostic of diagnostics) {
            if (diagnostic.source === MAPPER_DIAGNOSTIC_SOURCE) {
                withImports.push(toDiagnostic(diagnostic, options.source));
            }
        }
    }
    return withImports;
}

/**
 * `diagnostics` (in original coordinates, LSP shape) of the file `uri` with text `text`, plus
 * "Cannot find module" (2307) for its imports of `.svelte` files that don't exist, which Svelte's
 * ambient `declare module '*.svelte'` hides from TS7 (the TS6 path blanks the declaration out).
 * Also applies `@ts-ignore`/`@ts-expect-error` above such an import, including dropping the 2578
 * TS7 reported for an `@ts-expect-error` that it now covers. Svelte files and TS/JS files.
 *
 * Nothing is added if TS7's snapshot has a different text for the file.
 *
 * @param source the `source` of the added diagnostics, like the file's other TypeScript diagnostics
 */
export async function withUnresolvedSvelteImports(
    diagnostics: Diagnostic[],
    api: TsApiAccess,
    uri: string,
    text: string,
    source: string | undefined
): Promise<Diagnostic[]> {
    // TS7's text has no byte order mark, the file read from disk can
    const unresolved = await findUnresolvedSvelteImports(api, uri, text.replace(/^\uFEFF/, ''));
    return addUnresolvedSvelteImports(
        diagnostics,
        (unresolved ?? []).map((diagnostic) => ({ ...diagnostic, source }))
    );
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

/**
 * The template AST for the `bind:` relocation, loaded on demand. From `svelte2tsx/tsgo`, the
 * entry point that doesn't load TypeScript 6 (parsing the template needs no TypeScript at all).
 */
async function loadTemplateAst(document: Document): Promise<TemplateAstWalker> {
    const { internalHelpers } = await import('svelte2tsx/tsgo');
    return parseTemplateAst(document, internalHelpers.parseTemplateOnly);
}
