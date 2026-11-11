import * as vscode from 'vscode';
import type {
    ExtensionAPI as TsExtensionAPI,
    Position,
    Range,
    TextEdit,
    WorkspaceEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { getOpenDocument } from './documents';
import type { SvelteLanguageServerAccess } from './index';
import { isAtDollarIdentifier, isSvelteUri, timedOut, withTimeout } from './utils';

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
 *
 * TS7's own edit breaks the code if the rename did start at a `$store`. It is therefore only passed
 * on if the position can't be one (no `$name` there), or if the language server says that it isn't
 * one. If we can't find out, or the nested rename fails, there is no rename at all. That has to be
 * `null`: when a middleware throws, TS7 uses its own response.
 */
export function registerStoreMiddleware(
    api: TsExtensionAPI,
    access: SvelteLanguageServerAccess,
    log: (message: string) => void
): vscode.Disposable {
    return api.registerLspMiddleware('textDocument/rename', async (result, { params }) => {
        const client = access.getContentMapperModeClient();
        if (!client || !isSvelteUri(params.textDocument.uri)) {
            return result;
        }
        // Also saves the round trip to the language server for every other rename
        const document = getOpenDocument(vscode.Uri.parse(params.textDocument.uri));
        if (document && !isAtDollarIdentifier(document, params.position)) {
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
            if (binding === timedOut) {
                log(`[tsgo middleware] rename ($store handling) timed out, not renaming`);
                return null;
            }
            if (!binding) {
                // a `$name` that is no store subscription (e.g. a property): TS7's edit is right
                return result;
            }
            const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
                'vscode.executeDocumentRenameProvider',
                vscode.Uri.parse(binding.uri),
                new vscode.Position(binding.position.line, binding.position.character),
                params.newName.replace(/^\$/, '')
            );
            return edit ? toLspWorkspaceEdit(edit) : null;
        } catch (error) {
            log(`[tsgo middleware] rename ($store handling) failed, not renaming: ${error}`);
            return null;
        }
    });
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
