import type {
    CompletionItem,
    CompletionList,
    CompletionParams
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { fixImportEdits, ImportEditOptions } from './importEdits';
import {
    getTagNameContext,
    globalsSortText,
    isComponentTagCandidate,
    TagNameContext
} from './componentTagText';

/**
 * Names that come from svelte2tsx's generated code or the svelte2tsx shims and are in scope of the
 * virtual file, but which users never write themselves.
 * Mirrors `isNoSvelte2tsxCompletion` of the TS6 CompletionProvider, plus some names that are
 * only visible with the content mapper output.
 * Superset of `isGeneratedIdentifier` in the language server
 * (`plugins/typescript-go/middleware/generatedNames.ts`), keep them in sync.
 */
const exactNames = new Set([
    // internalHelpers.renderName
    '$$render',
    '$$ComponentProps',
    'svelteHTML',
    'svelteNative',
    // svelte2tsxTypes of the TS6 CompletionProvider
    'Svelte2TsxComponent',
    'Svelte2TsxComponentConstructorParameters',
    'SvelteComponentConstructor',
    'SvelteActionReturnType',
    'SvelteTransitionConfig',
    'SvelteTransitionReturnType',
    'SvelteAnimationReturnType',
    'SvelteWithOptionalProps',
    'SvelteAllProps',
    'SveltePropsAnyFallback',
    'SvelteSlotsAnyFallback',
    'SvelteRestProps',
    'SvelteSlots',
    'SvelteStore'
]);

export function isGeneratedCompletion(label: string): boolean {
    return (
        exactNames.has(label) ||
        label.startsWith('__sveltets_') ||
        label.startsWith('$$_') ||
        // the default export class of the current component, e.g. `Button__SvelteComponent_`
        label.endsWith('__SvelteComponent_')
    );
}

export type CompletionResult = CompletionItem[] | CompletionList | null;

const componentSuffix = '__SvelteComponent_';

/**
 * Auto-imports of Svelte components are named after the default export of the virtual file,
 * e.g. `Button__SvelteComponent_` from `./Button.svelte`, and would insert
 * `import Button__SvelteComponent_ from './Button.svelte'`. Rename them to `Button` (label, insert
 * text and import edit), like the TS6 `CompletionProvider` did.
 * Applies to `completionItem/resolve` results as well, and to any file (also `.ts` importing a
 * component).
 */
export function renameComponentAutoImport(item: CompletionItem): CompletionItem {
    const autoImport = (
        item.data as { autoImport?: { moduleSpecifier?: string; name?: string } } | undefined
    )?.autoImport;
    // `completionItem/resolve` gets our renamed item and returns its label, but recomputes the
    // import edit with the generated name. The name in `data` stays the generated one.
    const generated = autoImport?.name ?? item.label;
    if (!autoImport?.moduleSpecifier?.endsWith('.svelte') || !generated.endsWith(componentSuffix)) {
        return item;
    }
    const name = generated.slice(0, -componentSuffix.length);
    const rename = (text: string) => text.split(generated).join(name);
    return {
        ...item,
        label: rename(item.label),
        insertText: item.insertText ? rename(item.insertText) : name,
        filterText: item.filterText ? rename(item.filterText) : undefined,
        additionalTextEdits: item.additionalTextEdits?.map((edit) => ({
            ...edit,
            newText: rename(edit.newText)
        }))
    };
}

/** For non-Svelte files: only renames component auto-imports */
export function renameComponentAutoImports<T extends CompletionResult>(result: T): T {
    return mapItems(result, (items) => items.map(renameComponentAutoImport));
}

/** Drops svelte2tsx generated names, renames component auto-imports */
export function filterGeneratedCompletions<T extends CompletionResult>(result: T): T {
    return mapItems(result, (items) =>
        items.map(renameComponentAutoImport).filter((item) => !isGeneratedCompletion(item.label))
    );
}

function mapItems<T extends CompletionResult>(
    result: T,
    map: (items: CompletionItem[]) => CompletionItem[]
): T {
    if (!result) {
        return result;
    }
    if (Array.isArray(result)) {
        return map(result) as T;
    }
    return { ...result, items: map(result.items) } as T;
}

function itemsOf(result: CompletionResult): CompletionItem[] {
    return !result ? [] : Array.isArray(result) ? result : result.items;
}

/** LSP `CompletionItemKind`s a component can have: Function, Variable, Class, Module (namespace) */
const componentKinds = new Set([3, 6, 7, 9]);

/**
 * Components in scope or auto-importable. No globals (`<Array>` is never meant; deprecated ones
 * have a `z` prefix) and no interfaces/enums/keywords.
 */
function isComponentTagItem(item: CompletionItem) {
    return (
        isComponentTagCandidate(item.label) &&
        item.sortText?.replace(/^z/, '') !== globalsSortText &&
        (item.kind === undefined || componentKinds.has(item.kind))
    );
}

function isAutoImport(item: CompletionItem) {
    return !!(item.data as { autoImport?: unknown } | undefined)?.autoImport;
}

export interface TextDocumentView {
    getText(): string;
    offsetAt(position: { line: number; character: number }): number;
    positionAt(offset: number): { line: number; character: number };
}

/**
 * The component candidates of the last script query. They only depend on the script, so typing in
 * the template (`<` -> `<C` -> `<Ch`) reuses them instead of asking TS7 again (an extra request
 * through `vscode.executeCompletionItemProvider` costs ~150-300ms with ~1800 items).
 * Side effect: auto-imports found while the template didn't parse (`<`) are still offered at `<C`,
 * where TS7 drops them in files that already have imports.
 * Only needed because of the TS7 gaps described at `transformCompletions`.
 */
export interface ScriptCompletionCache {
    key?: string;
    items?: CompletionItem[];
}

export interface CompletionMiddlewareHost {
    cache: ScriptCompletionCache;
    importEditOptions: ImportEditOptions;
    /** The open document for an LSP uri */
    getDocument(uri: string): TextDocumentView | undefined;
    /**
     * Asks TS7 for completions at another position of the same document and returns its raw LSP
     * result (or undefined on timeout/failure).
     */
    requestCompletions(
        uri: string,
        position: { line: number; character: number }
    ): Promise<CompletionResult | undefined>;
}

/**
 * Post-processes TS7 completions for a Svelte file:
 * - drops svelte2tsx generated names, renames component auto-imports
 * - at a start tag name in the template (`<|`, `<Ch|`), only offers components (see below)
 *
 * Two gaps of TS7 at a tag name in the template, both filled with an extra TS7 request at the start
 * of the instance script, where all top-level bindings are in scope (see `getScriptQueryOffset`):
 * - At `<|` TS7 returns nothing. VS Code only asks a provider again while the user keeps typing if
 *   its previous list was `isIncomplete` *and* non-empty, so TS7 wasn't asked at `<C` anymore and
 *   components only showed up once the HTML suggestions ran out (`<Ch`) and VS Code started over.
 *   We return the components from the script position as incomplete list, which makes VS Code ask
 *   TS7 again at `<C` with the real position.
 *   Root cause: TS7 decides not to answer the `<` trigger. It validates trigger characters against
 *   the virtual code (`isValidTrigger` in TypeScript's `tsc/internal/ls/completions.go`): `<` only
 *   counts if the token before the cursor is a `<` that may open a JSX tag. In svelte2tsx output
 *   it's `(` of `__sveltets_2_ensureComponent(`. So `triggerCharacter: "<"` is rejected even at a
 *   perfectly mapped position (measured: Ctrl+Space after `<` in `<C` returns 1117 items, the same
 *   request with the trigger character `null`). Better svelte2tsx output for a bare `<` (it
 *   currently doesn't parse) would therefore not help, and middleware can't change the request.
 *   REMOVE WHEN TS7 validates trigger characters of content-mapped files against the original text
 *   (or lets mappers declare them): the `atTagStart` branch below and the incomplete list.
 * - TS7 offers no auto-imports at template positions (measured, probably because the cursor is at
 *   the end of a mapped span), so not-yet-imported components were missing. We add those from the
 *   script position. Remove (together with the script request and the cache) once TS7 offers
 *   them itself, see content-mappers.md §2.5.
 */
export async function transformCompletions(
    result: CompletionResult,
    params: Pick<CompletionParams, 'textDocument' | 'position'>,
    host: CompletionMiddlewareHost
): Promise<CompletionResult> {
    const document = host.getDocument(params.textDocument.uri);
    const transformed = await transformTagNameCompletions(result, params, host, document);
    return document
        ? mapItems(transformed, (items) =>
              items.map((item) => fixImportEdits(item, document, host.importEditOptions))
          )
        : transformed;
}

/** `completionItem/resolve` recomputes the import edit, so it needs the same fixes */
export function transformResolvedItem(
    item: CompletionItem,
    document: TextDocumentView | undefined,
    options: ImportEditOptions
): CompletionItem {
    const renamed = renameComponentAutoImport(item);
    return document ? fixImportEdits(renamed, document, options) : renamed;
}

async function transformTagNameCompletions(
    result: CompletionResult,
    params: Pick<CompletionParams, 'textDocument' | 'position'>,
    host: CompletionMiddlewareHost,
    document: TextDocumentView | undefined
): Promise<CompletionResult> {
    const filtered = filterGeneratedCompletions(result);
    const context: TagNameContext | undefined =
        document && getTagNameContext(document.getText(), document.offsetAt(params.position));
    if (!document || !context) {
        return filtered;
    }

    const items = itemsOf(filtered).filter(isComponentTagItem);
    const atTagStart = itemsOf(filtered).length === 0;
    // lowercase names are HTML elements, only keep what TS7 has (VS Code filters case-insensitively)
    const mayBeComponent = context.word === '' || isComponentTagCandidate(context.word);
    if (!mayBeComponent) {
        return atTagStart ? filtered : mapItems(filtered, () => items);
    }

    let scriptItems: CompletionItem[] = [];
    if (context.scriptQueryOffset !== undefined) {
        // the offset is part of the key: the import edits of auto-imports are absolute positions
        const cacheKey = `${params.textDocument.uri}\n${context.scriptQueryOffset}\n${context.scriptText}`;
        const cached = host.cache.key === cacheKey ? host.cache.items : undefined;
        if (cached) {
            scriptItems = cached;
        } else {
            const fromScript = await host.requestCompletions(
                params.textDocument.uri,
                document.positionAt(context.scriptQueryOffset)
            );
            scriptItems = componentItemsOf(fromScript);
            if (fromScript) {
                host.cache.key = cacheKey;
                host.cache.items = scriptItems;
            }
        }
    }

    // REMOVE WHEN TS7 answers the `<` trigger in content-mapped files (see above): then TS7's own
    // result at `<|` isn't empty anymore and the incomplete list isn't needed to get asked again
    if (atTagStart) {
        // TS7 may offer an auto-import for something already imported, e.g. `Child`
        const locals = new Set(scriptItems.filter((i) => !isAutoImport(i)).map((i) => i.label));
        const items = scriptItems.filter((i) => !isAutoImport(i) || !locals.has(i.label));
        return items.length > 0 ? { isIncomplete: true, items } : filtered;
    }
    const labels = new Set(items.map((item) => item.label));
    let autoImports = scriptItems.filter((item) => isAutoImport(item) && !labels.has(item.label));
    if (
        autoImports.length === 0 &&
        !items.some(isAutoImport) &&
        context.word !== '' &&
        params.position.character > 0
    ) {
        // No (usable) script, e.g. a file with only `<Child `, or `<script></script>`: TS7 offers
        // auto-imports inside the tag name, but not at its end (`<Child|`, the end of a mapped span,
        // measured). Ask one character to the left; TS7 filters by the whole name anyway.
        const inside = await host.requestCompletions(params.textDocument.uri, {
            line: params.position.line,
            character: params.position.character - 1
        });
        autoImports = componentItemsOf(inside).filter(
            (item) => isAutoImport(item) && !labels.has(item.label)
        );
    }
    return mapItems(filtered, () => [...items, ...autoImports]);
}

function componentItemsOf(result: CompletionResult | undefined): CompletionItem[] {
    return itemsOf(filterGeneratedCompletions(result ?? null))
        .filter(isComponentTagItem)
        .map(withoutTextEdit);
}

/** Text edits of items from another position would replace text there */
function withoutTextEdit(item: CompletionItem): CompletionItem {
    if (!item.textEdit) {
        return item;
    }
    const { textEdit, ...rest } = item;
    return { ...rest, insertText: textEdit.newText };
}
