import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import type { TsApiAccess } from '../TsApiService';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import type { tsAst } from '../types';

/**
 * Imports of `.svelte` files that don't exist.
 *
 * Svelte's types declare `declare module '*.svelte'` (for projects without Svelte tooling), so
 * TypeScript resolves an import of a missing `.svelte` file to that ambient module instead of
 * reporting it (2307). The TS6 language server and svelte-check blank the declaration out; TS7
 * offers no way to do that, so the error is added afterwards: for each `.svelte` import whose module
 * is declared only by Svelte's types (resolved files are declared by themselves; a project's own
 * `declare module '*.svelte'` merges into the same symbol and keeps the import silent, like TS6).
 *
 * Whether the file is checked follows TypeScript's rules. A `// @ts-ignore` or `// @ts-expect-error`
 * applies only on the line directly above the import, in the code TS sees (the virtual code of
 * Svelte files); unlike TypeScript, one after code on that line, one with blank or comment lines
 * between, and block comments (`/* @ts-ignore *\/`) are not honoured.
 *
 * Known differences: an existing `.svelte` file outside the content mapper's `include` also gets the
 * 2307, next to TS's own TS18140. Only top-level `import`/`export … from` are covered (not
 * `import()` or `import x = require()`).
 */

const CANNOT_FIND_MODULE = 2307;
const UNUSED_TS_EXPECT_ERROR = 2578;

/** The files with Svelte's `declare module '*.svelte'` (Svelte 4/5, svelte2tsx's Svelte 3 shims) */
const SVELTE_AMBIENT_DECLARATION_FILES =
    /[\\/](?:svelte[\\/]types[\\/]index\.d\.ts|svelte2tsx[\\/]svelte-shims\.d\.ts)$/;

/** On a diagnostic of `findUnresolvedSvelteImports`: the comment directive above it, if any */
interface UnresolvedImportData {
    directive: { expectError: boolean; range: Range | undefined };
}

/**
 * TS2307 diagnostics (code, message and range like TypeScript's) for the imports and re-exports of
 * missing `.svelte` files in `uri`, in positions of the original file. A Svelte file or any other
 * file of the project TS7 knows. `undefined` if TS7's snapshot doesn't have `expectedText` (the text
 * the other diagnostics were computed for), or doesn't know the file.
 *
 * Like TypeScript: nothing in JavaScript files that aren't checked (`checkJs`, `// @ts-check`), and
 * nothing with `// @ts-nocheck`. Comment directives are applied by `addUnresolvedSvelteImports`.
 * Without `.svelte` in `expectedText`, nothing is asked of TS7.
 */
export async function findUnresolvedSvelteImports(
    api: TsApiAccess,
    uri: string,
    expectedText?: string
): Promise<Diagnostic[] | undefined> {
    if (expectedText !== undefined && !expectedText.includes('.svelte')) {
        return [];
    }
    return api.withSourceFile(uri, async (project, sourceFile) => {
        if (expectedText !== undefined && sourceFile.originalText !== expectedText) {
            return undefined;
        }
        const ast = api.astModule;
        if (!isChecked(ast, sourceFile, project.program.getCompilerOptions().checkJs)) {
            return [];
        }

        const specifiers: tsAst.StringLiteral[] = [];
        const statements: tsAst.Statement[] = [];
        for (const statement of sourceFile.statements) {
            const specifier = getModuleSpecifier(ast, statement);
            if (specifier && /\.svelte$/.test(specifier.text)) {
                specifiers.push(specifier);
                statements.push(statement);
            }
        }
        if (!specifiers.length) {
            return [];
        }

        const symbols = await project.checker.getSymbolAtLocation(specifiers);
        const mapper = new TsApiLocationMapper(ast);
        const diagnostics: Diagnostic[] = [];
        specifiers.forEach((specifier, i) => {
            const declarations = symbols[i]?.declarations ?? [];
            if (
                !declarations.length ||
                !declarations.every((declaration) =>
                    SVELTE_AMBIENT_DECLARATION_FILES.test(declaration.path)
                )
            ) {
                return;
            }
            const span = mapper.toOriginalSpan(sourceFile, specifier.getStart(), specifier.end);
            if (!span) {
                return;
            }
            const directive = findDirectiveAbove(ast, sourceFile, statements[i], specifier);
            const directiveSpan =
                directive && mapper.toOriginalSpan(sourceFile, directive.pos, directive.end);
            const data: UnresolvedImportData | undefined = directive && {
                directive: {
                    expectError: directive.expectError,
                    range:
                        directiveSpan &&
                        mapper.toRange(sourceFile, directiveSpan.start, directiveSpan.end)
                }
            };
            diagnostics.push({
                range: mapper.toRange(sourceFile, span.start, span.end),
                severity: DiagnosticSeverity.Error,
                source: 'ts',
                message: `Cannot find module '${specifier.text}' or its corresponding type declarations.`,
                code: CANNOT_FIND_MODULE,
                tags: [],
                data
            });
        });
        return diagnostics;
    });
}

/**
 * Adds `unresolved` (from `findUnresolvedSvelteImports`) to the other TypeScript diagnostics of the
 * file. Like TypeScript, a `@ts-ignore` or `@ts-expect-error` above an import hides its error, and
 * the `@ts-expect-error` is then no longer unused (TS7 reported 2578 for that comment, because
 * without the error it was).
 */
export function addUnresolvedSvelteImports(
    diagnostics: Diagnostic[],
    unresolved: Diagnostic[]
): Diagnostic[] {
    if (!unresolved.length) {
        return diagnostics;
    }
    const usedExpectErrors: Range[] = [];
    const added: Diagnostic[] = [];
    for (const diagnostic of unresolved) {
        const { data, ...withoutData } = diagnostic;
        const directive = (data as UnresolvedImportData | undefined)?.directive;
        if (!directive) {
            added.push(withoutData);
        } else if (directive.expectError && directive.range) {
            usedExpectErrors.push(directive.range);
        }
    }
    return [
        ...diagnostics.filter(
            (diagnostic) =>
                !(
                    diagnostic.code === UNUSED_TS_EXPECT_ERROR &&
                    usedExpectErrors.some((range) => isSameStart(range, diagnostic.range))
                )
        ),
        ...added
    ];
}

function getModuleSpecifier(
    ast: TsApiAccess['astModule'],
    statement: tsAst.Statement
): tsAst.StringLiteral | undefined {
    if (
        (ast.isImportDeclaration(statement) || ast.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ast.isStringLiteral(statement.moduleSpecifier)
    ) {
        return statement.moduleSpecifier;
    }
    return undefined;
}

/**
 * Whether TypeScript reports semantic errors for the file: not with a `// @ts-nocheck` pragma (a
 * leading comment; svelte2tsx moves the script's to the top of the virtual code), JavaScript only
 * with `checkJs` or `// @ts-check`
 */
function isChecked(
    ast: TsApiAccess['astModule'],
    sourceFile: tsAst.SourceFile,
    checkJs: boolean | undefined
): boolean {
    const text = sourceFile.text;
    const pragmas = (ast.getLeadingCommentRanges(text, 0) ?? []).map((comment) =>
        text.slice(comment.pos, comment.end)
    );
    if (pragmas.some((pragma) => /^\/\/\s*@ts-nocheck\b/.test(pragma))) {
        return false;
    }
    const isJs =
        sourceFile.scriptKind === ast.ScriptKind.JS || sourceFile.scriptKind === ast.ScriptKind.JSX;
    return !isJs || !!checkJs || pragmas.some((pragma) => /^\/\/\s*@ts-check\b/.test(pragma));
}

/** A `// @ts-ignore` / `// @ts-expect-error` comment of `statement`, on the line above `specifier` */
function findDirectiveAbove(
    ast: TsApiAccess['astModule'],
    sourceFile: tsAst.SourceFile,
    statement: tsAst.Statement,
    specifier: tsAst.StringLiteral
): { expectError: boolean; pos: number; end: number } | undefined {
    const comments = ast.getLeadingCommentRanges(sourceFile.text, statement.pos) ?? [];
    const comment = comments[comments.length - 1];
    const match =
        comment && /^\/\/\s*@ts-(ignore|expect-error)\b/.exec(sourceFile.text.slice(comment.pos));
    const line = (position: number) => sourceFile.getLineAndCharacterOfPosition(position).line;
    if (!match || line(comment.pos) !== line(specifier.getStart()) - 1) {
        return undefined;
    }
    return { expectError: match[1] === 'expect-error', pos: comment.pos, end: comment.end };
}

function isSameStart(a: Range, b: Range): boolean {
    return a.start.line === b.start.line && a.start.character === b.start.character;
}
