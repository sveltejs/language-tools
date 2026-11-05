import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type {
    ExtensionAPI as TsExtensionAPI,
    LspMiddlewareResult,
    LspMiddlewareContext
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { renameComponentAutoImports } from './completions';
import { createCompletionMiddleware } from './completionsHost';
import { registerStoreMiddleware } from './stores';

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
    | 'textDocument/rename';

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
    'textDocument/rename': 2000
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
                forwardToSvelteLanguageServer(method, result, context, access, log)
            )
        );
    }

    const completionMiddleware = createCompletionMiddleware(log);
    disposables.push(
        api.registerLspMiddleware('textDocument/completion', (result, { params }) => {
            if (!access.getContentMapperModeClient()) {
                return result;
            }
            if (!isSvelteUri(params.textDocument.uri)) {
                // e.g. `.ts` files auto-importing a component
                return renameComponentAutoImports(result);
            }
            return completionMiddleware.completion(result, params);
        }),
        api.registerLspMiddleware('completionItem/resolve', (item) => {
            if (!access.getContentMapperModeClient() || !item) {
                return item;
            }
            // renames component auto-imports; in Svelte files also fixes the import placement
            return completionMiddleware.resolve(item);
        })
    );

    // Runs after the forwarded rename middleware above (registration order)
    disposables.push(registerStoreMiddleware(api, access, log));

    return vscode.Disposable.from(...disposables);
}

async function forwardToSvelteLanguageServer<M extends ForwardedMethod>(
    method: M,
    result: LspMiddlewareResult<M>,
    { params }: LspMiddlewareContext<M>,
    access: SvelteLanguageServerAccess,
    log: (message: string) => void
): Promise<LspMiddlewareResult<M>> {
    if (
        !isSvelteUri(params.textDocument.uri) &&
        !(crossFileMethods.has(method) && touchesSvelteFile(result))
    ) {
        return result;
    }
    const client = access.getContentMapperModeClient();
    if (!client) {
        return result;
    }

    const cancellation = new vscode.CancellationTokenSource();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), forwardTimeouts[method]);
    });
    const start = Date.now();
    try {
        const transformed = await Promise.race([
            client.sendRequest<LspMiddlewareResult<M>>(
                TransformTsgoResponseRequest,
                { method, params, result },
                cancellation.token
            ),
            timeout
        ]);
        if (transformed === 'timeout') {
            cancellation.cancel();
            log(`[tsgo middleware] ${method} timed out after ${Date.now() - start}ms`);
            return result;
        }
        return transformed;
    } catch (error) {
        log(`[tsgo middleware] ${method} failed: ${error}`);
        return result;
    } finally {
        clearTimeout(timer);
        cancellation.dispose();
    }
}

function isSvelteUri(uri: string) {
    return uri.endsWith('.svelte');
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
