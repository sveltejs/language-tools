import * as vscode from 'vscode';
import type {
    ExtensionAPI as TsExtensionAPI,
    Position,
    Range,
    TextEdit,
    WorkspaceEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import type { SvelteLanguageServerAccess } from './index';

/** Has to match `StoreBindingRequest` in the language server */
const StoreBindingRequest = '$/tsgoStoreBinding';

/** How long we wait for the Svelte language server to find the store of a `$store` */
const storeBindingTimeout = 1000;

interface StoreBinding {
    uri: string;
    position: Position;
}

/**
 * Rename starting at `$store`: TS7 would only rename the `$store` usages (it sees `store` and `$store`
 * as unrelated variables), so we rename `store` itself instead, like TS6 did.
 *
 * Everything else about `$store` (references, definition, prepareRename, the `$store` edits when
 * renaming `store`) is done in the Svelte language server with the TS7 API (`middleware/stores.ts`
 * there). The one thing it can't do is asking TS7 for a rename at another position, which needs
 * `vscode.executeDocumentRenameProvider`. The language server tells us where `store` is bound; the
 * nested rename then comes back through the forwarded rename middleware, which adds the `$store`
 * edits.
 */
export function registerStoreMiddleware(
    api: TsExtensionAPI,
    access: SvelteLanguageServerAccess,
    log: (message: string) => void
): vscode.Disposable {
    return api.registerLspMiddleware('textDocument/rename', async (result, { params }) => {
        const client = access.getContentMapperModeClient();
        if (!client || !params.textDocument.uri.endsWith('.svelte')) {
            return result;
        }
        try {
            const binding = await withTimeout(
                client.sendRequest<StoreBinding | null>(StoreBindingRequest, {
                    textDocument: params.textDocument,
                    position: params.position
                }),
                storeBindingTimeout
            );
            if (!binding) {
                return result;
            }
            const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
                'vscode.executeDocumentRenameProvider',
                vscode.Uri.parse(binding.uri),
                new vscode.Position(binding.position.line, binding.position.character),
                params.newName.replace(/^\$/, '')
            );
            // null instead of TS7's edit, which would only rename the `$store` usages
            return edit ? toLspWorkspaceEdit(edit) : null;
        } catch (error) {
            log(`[tsgo middleware] rename ($store handling) failed: ${error}`);
            return result;
        }
    });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<null>((resolve) => {
                timer = setTimeout(() => resolve(null), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function toLspRange(range: vscode.Range): Range {
    return {
        start: { line: range.start.line, character: range.start.character },
        end: { line: range.end.line, character: range.end.character }
    };
}

function toLspWorkspaceEdit(edit: vscode.WorkspaceEdit): WorkspaceEdit {
    const changes: Record<string, TextEdit[]> = {};
    for (const [uri, edits] of edit.entries()) {
        changes[uri.toString()] = edits.map((e) => ({
            range: toLspRange(e.range),
            newText: e.newText
        }));
    }
    return { changes };
}
