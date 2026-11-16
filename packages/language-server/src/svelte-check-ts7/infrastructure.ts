import { relative } from 'path';
import type { ApiDiagnostic } from './convert';
import { flattenMessage } from './convert';

/**
 * A problem that makes the TypeScript 7 results meaningless (TS version, configuration, the
 * content mapper failing). svelte-check reports it as a failure instead of diagnostics.
 */
export class SvelteCheckTs7Error extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SvelteCheckTs7Error';
    }
}

export const CONTENT_MAPPER_PACKAGE = '@sveltejs/ts-content-mapper';

const contentMapperEntry = `"contentMappers": [{ "package": "${CONTENT_MAPPER_PACKAGE}", "extensions": [".svelte"] }]`;

const ISSUES_URL = 'https://github.com/sveltejs/language-tools/issues';

const MAX_LISTED_FAILURES = 20;

/** Codes of TS7's content mapper diagnostics (18065–18124) */
const enum ContentMapperCode {
    First = 18065,
    TransformFailed = 18069,
    DisabledAfterFailures = 18070,
    InVirtualCode = 18074,
    PackageNotResolved = 18075,
    /** LSP only: the aggregate of problems in unmapped virtual code */
    VirtualCodeProblems = 18080,
    NotInitialized = 18099,
    Last = 18124
}

/** Category `Message`: the details in a message chain */
const MESSAGE_CATEGORY = 3;

/**
 * The content mapper could not be loaded, started, or failed to transform a file. Files affected
 * by this are empty or incomplete for TypeScript, so their diagnostics can't be trusted.
 */
export function isContentMapperFailure(diagnostic: ApiDiagnostic): boolean {
    return (
        diagnostic.code >= ContentMapperCode.First &&
        diagnostic.code <= ContentMapperCode.Last &&
        diagnostic.code !== ContentMapperCode.InVirtualCode &&
        diagnostic.code !== ContentMapperCode.VirtualCodeProblems &&
        diagnostic.category !== MESSAGE_CATEGORY
    );
}

export function throwIfContentMapperFailed(diagnostics: Iterable<ApiDiagnostic>, cwd: string) {
    const failures = dedupeDiagnostics([...diagnostics].filter(isContentMapperFailure));
    if (!failures.length) {
        return;
    }

    const codes = new Set(failures.map((failure) => failure.code));
    const hints: string[] = [];
    if (codes.has(ContentMapperCode.PackageNotResolved)) {
        hints.push(
            `Install the content mapper next to your tsconfig: npm install --save-dev ${CONTENT_MAPPER_PACKAGE}`
        );
    }
    if (codes.has(ContentMapperCode.NotInitialized)) {
        hints.push(
            'The content mapper runs as a separate process, started with the command of its package.json.'
        );
    }
    if (
        codes.has(ContentMapperCode.TransformFailed) ||
        codes.has(ContentMapperCode.DisabledAfterFailures)
    ) {
        hints.push(
            `This is likely a bug in the content mapper. If it's ${CONTENT_MAPPER_PACKAGE}, please report it at ${ISSUES_URL}, ideally with the file.`
        );
    }

    const shown = failures.slice(0, MAX_LISTED_FAILURES);
    throw new SvelteCheckTs7Error(
        [
            'TypeScript could not use the Svelte content mapper, so its results for Svelte files would be incomplete:',
            ...shown.map((failure) => '  ' + formatDiagnostic(failure, cwd).replace(/\n/g, '\n  ')),
            ...(failures.length > shown.length
                ? [`  ... and ${failures.length - shown.length} more`]
                : []),
            ...hints
        ].join('\n')
    );
}

export function missingContentMapperError(tsconfigPath: string): SvelteCheckTs7Error {
    return new SvelteCheckTs7Error(
        `${tsconfigPath} doesn't map .svelte files, so TypeScript 7 can't check them. ` +
            `Add this to the tsconfig (top level, next to "compilerOptions"):\n` +
            `  ${contentMapperEntry}\n` +
            `and install the content mapper: npm install --save-dev ${CONTENT_MAPPER_PACKAGE}`
    );
}

/** `contentMappers` (including entries inherited through `extends`) has an entry for `.svelte` */
export function hasSvelteContentMapper(rawConfig: unknown): boolean {
    const contentMappers = (rawConfig as { contentMappers?: unknown } | undefined)?.contentMappers;
    return (
        Array.isArray(contentMappers) &&
        contentMappers.some(
            (mapper) => Array.isArray(mapper?.extensions) && mapper.extensions.includes('.svelte')
        )
    );
}

/** TS7 reports some project diagnostics both as program and as global diagnostics */
export function dedupeDiagnostics(diagnostics: ApiDiagnostic[]): ApiDiagnostic[] {
    const seen = new Set<string>();
    return diagnostics.filter((diagnostic) => {
        const key = JSON.stringify([
            diagnostic.fileName,
            diagnostic.pos,
            diagnostic.end,
            diagnostic.code,
            diagnostic.text
        ]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function formatDiagnostic(diagnostic: ApiDiagnostic, cwd: string): string {
    const location = diagnostic.fileName
        ? relative(cwd, diagnostic.fileName) +
          (diagnostic.startPosition
              ? `:${diagnostic.startPosition.line + 1}:${diagnostic.startPosition.character + 1}`
              : '') +
          ' - '
        : '';
    return `${location}error TS${diagnostic.code}: ${flattenMessage(diagnostic)}`;
}
