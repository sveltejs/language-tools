import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type {
    ExtensionAPI as TsExtensionAPI,
    LspMiddlewareResult,
    LspMiddlewareContext
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { transformCodeActions } from './codeActions';
import { renameComponentAutoImports } from './completions';
import { createCompletionMiddleware, getImportEditOptions } from './completionsHost';
import { getOpenDocument } from './documents';
import { isInStartTag } from './componentTagText';
import { registerStoreMiddleware } from './stores';
import { isSvelteUri, timedOut, withTimeout } from './utils';

/** Has to match `TransformTsgoResponseRequest` in the language server */
const TransformTsgoResponseRequest = '$/transformTsgoResponse';

export interface SvelteLanguageServerAccess {
    /** The Svelte language client, if it is running in content mapper mode */
    getContentMapperModeClient(): LanguageClient | undefined;
}

type ForwardedMethod =
    | 'textDocument/diagnostic'
    | 'textDocument/documentHighlight'
    | 'custom/textDocument/multiDocumentHighlight'
    | 'textDocument/signatureHelp'
    | 'textDocument/hover'
    | 'textDocument/inlayHint'
    | 'textDocument/definition'
    | 'textDocument/typeDefinition'
    | 'textDocument/implementation'
    | 'textDocument/references'
    | 'textDocument/prepareRename'
    | 'textDocument/rename'
    | 'textDocument/documentSymbol';

/**
 * How long we wait for the Svelte language server before giving up and using TS7's response as-is.
 * The middleware runs inside TS7's request pipeline, so a busy Svelte LS would otherwise block
 * TypeScript features.
 */
const forwardTimeouts: Record<ForwardedMethod, number> = {
    'textDocument/diagnostic': 3000,
    'textDocument/documentHighlight': 500,
    'custom/textDocument/multiDocumentHighlight': 500,
    'textDocument/signatureHelp': 500,
    'textDocument/hover': 500,
    'textDocument/inlayHint': 1000,
    'textDocument/definition': 1000,
    'textDocument/typeDefinition': 1000,
    'textDocument/implementation': 1000,
    // these run TS7 API queries for `$store` (references of the store, of each subscription)
    'textDocument/references': 2000,
    'textDocument/prepareRename': 500,
    'textDocument/rename': 2000,
    // adds the instance script's symbols from the TS7 API (TS7 drops them)
    'textDocument/documentSymbol': 1000
};

/**
 * Also forwarded for non-Svelte files if the result reaches into a Svelte file: references and
 * rename of a store declared in a `.ts` file also need its `$store` usages.
 */
const crossFileMethods = new Set<ForwardedMethod>([
    'textDocument/references',
    'textDocument/rename'
]);

export function supportsLspMiddleware(api: TsExtensionAPI | undefined): boolean {
    return typeof api?.registerLspMiddleware === 'function';
}

/**
 * Registers middleware on the TypeScript 7 extension to post-process its responses for Svelte files.
 *
 * Two styles:
 * - forwarded: the response is sent to the Svelte language server (`$/transformTsgoResponse`), which
 *   has the document, the template AST and the Svelte/HTML/CSS plugins, and where the logic can be
 *   shared with other clients (diagnostics, highlights, hover, signature help, inlay hints, locations)
 * - local: pure transformations that need no Svelte knowledge beyond names (completions). Avoids an
 *   IPC round trip with a large payload in a latency sensitive path.
 */
export function registerSvelteLspMiddleware(
    api: TsExtensionAPI,
    access: SvelteLanguageServerAccess,
    log: (message: string) => void
): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    for (const method of Object.keys(forwardTimeouts) as ForwardedMethod[]) {
        disposables.push(
            api.registerLspMiddleware(method, (result, context) =>
                forwardToSvelteLanguageServer(
                    method,
                    result,
                    context,
                    access,
                    log,
                    forwardTimeouts[method]
                )
            )
        );
    }

    const completionMiddleware = createCompletionMiddleware(log);
    disposables.push(
        api.registerLspMiddleware('textDocument/completion', async (result, context) => {
            const { params } = context;
            if (!access.getContentMapperModeClient()) {
                return result;
            }
            if (!isSvelteUri(params.textDocument.uri)) {
                // e.g. `.ts` files auto-importing a component
                return renameComponentAutoImports(result);
            }
            const transformed = await completionMiddleware.completion(result, params);
            // In a start tag, TS7 offers the attributes of the `svelteHTML` typings, the Svelte LS
            // the HTML ones. The LS drops the duplicates like TS6 mode did (PluginHost). Only
            // forwarded there: completions are hot and large.
            const document = getOpenDocument(vscode.Uri.parse(params.textDocument.uri));
            if (
                document &&
                hasCompletionItems(transformed) &&
                isInStartTag(document.getText(), document.offsetAt(params.position))
            ) {
                return forwardToSvelteLanguageServer(
                    'textDocument/completion',
                    transformed,
                    context,
                    access,
                    log,
                    startTagCompletionTimeout
                );
            }
            return transformed;
        }),
        api.registerLspMiddleware('completionItem/resolve', (item) => {
            if (!access.getContentMapperModeClient() || !item) {
                return item;
            }
            // renames component auto-imports; in Svelte files also fixes the import placement
            return completionMiddleware.resolve(item);
        })
    );

    disposables.push(
        api.registerLspMiddleware('textDocument/codeAction', (result, { params }) => {
            if (!access.getContentMapperModeClient() || !isSvelteUri(params.textDocument.uri)) {
                return result;
            }
            return transformCodeActions(
                result,
                params.textDocument.uri,
                getOpenDocument(vscode.Uri.parse(params.textDocument.uri)),
                getImportEditOptions()
            );
        })
    );

    // No formatting middleware: svelte2tsx's span map turns TS7's Formatting feature off, so TS7
    // returns no edits for Svelte files (LS test `features/FormattingProvider.test.ts`, e2e
    // `features` formatting checks). Its formatter stays registered (see the README).

    // Runs after the forwarded rename middleware above (registration order)
    disposables.push(registerStoreMiddleware(api, access, log));

    return vscode.Disposable.from(...disposables);
}

/** Completions in a start tag (`<input on|`): ~450 TS7 items, deduped in the LS */
const startTagCompletionTimeout = 300;

function hasCompletionItems(result: LspMiddlewareResult<'textDocument/completion'>) {
    return !!result && (Array.isArray(result) ? result.length > 0 : result.items.length > 0);
}

async function forwardToSvelteLanguageServer<M extends ForwardedMethod | 'textDocument/completion'>(
    method: M,
    result: LspMiddlewareResult<M>,
    { params }: LspMiddlewareContext<M>,
    access: SvelteLanguageServerAccess,
    log: (message: string) => void,
    timeout: number
): Promise<LspMiddlewareResult<M>> {
    if (
        !isSvelteUri(params.textDocument.uri) &&
        !(crossFileMethods.has(method as ForwardedMethod) && touchesSvelteFile(result))
    ) {
        return result;
    }
    const client = access.getContentMapperModeClient();
    if (!client) {
        return result;
    }

    const cancellation = new vscode.CancellationTokenSource();
    const start = Date.now();
    try {
        const transformed = await withTimeout(
            client.sendRequest<LspMiddlewareResult<M>>(
                TransformTsgoResponseRequest,
                { method, params, result },
                cancellation.token
            ),
            timeout
        );
        if (transformed === timedOut) {
            cancellation.cancel();
            log(`[tsgo middleware] ${method} timed out after ${Date.now() - start}ms`);
            return result;
        }
        return transformed;
    } catch (error) {
        log(`[tsgo middleware] ${method} failed: ${error}`);
        return result;
    } finally {
        cancellation.dispose();
    }
}

/** Locations or a workspace edit with a `.svelte` file in it */
function touchesSvelteFile(result: unknown): boolean {
    if (!result || typeof result !== 'object') {
        return false;
    }
    if (Array.isArray(result)) {
        return result.some((location) => isSvelteUri(location?.uri ?? location?.targetUri ?? ''));
    }
    const edit = result as {
        changes?: Record<string, unknown>;
        documentChanges?: Array<{ textDocument?: { uri: string } }>;
    };
    return (
        Object.keys(edit.changes ?? {}).some(isSvelteUri) ||
        (edit.documentChanges ?? []).some((change) => isSvelteUri(change.textDocument?.uri ?? ''))
    );
}
