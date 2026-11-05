import * as vscode from 'vscode';
import type {
    CompletionItem,
    CompletionParams
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import {
    CompletionMiddlewareHost,
    CompletionResult,
    TextDocumentView,
    transformCompletions,
    transformResolvedItem
} from './completions';
import { ImportEditOptions } from './importEdits';

/** How long we wait for the extra completion request at the script position */
const nestedRequestTimeout = 1000;

/**
 * The VS Code side of `transformCompletions`: document lookup and the extra TS7 request.
 * The extra request is a workaround for TS7 gaps (see `transformCompletions`, marked REMOVE WHEN).
 *
 * The extra request goes through `vscode.executeCompletionItemProvider`, i.e. through all
 * completion providers and this middleware again. While it is pending, its position is registered
 * in `nested` and the middleware captures TS7's raw LSP result there instead of transforming it.
 * The raw items are needed because the `data` of TS7's items drives `completionItem/resolve`
 * (details, auto-import edits), and the VS Code command converts the items and drops it.
 */
export function createCompletionMiddleware(log: (message: string) => void) {
    const nested = new Map<string, { result?: CompletionResult }>();

    const host: CompletionMiddlewareHost = {
        cache: {},
        get importEditOptions() {
            return getImportEditOptions();
        },
        getDocument(uri) {
            const parsed = vscode.Uri.parse(uri).toString();
            return toView(vscode.workspace.textDocuments.find((d) => d.uri.toString() === parsed));
        },
        async requestCompletions(uri, position) {
            const key = requestKey(uri, position);
            const capture: { result?: CompletionResult } = {};
            nested.set(key, capture);
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const completed = await Promise.race([
                    vscode.commands.executeCommand(
                        'vscode.executeCompletionItemProvider',
                        vscode.Uri.parse(uri),
                        new vscode.Position(position.line, position.character)
                    ),
                    new Promise<'timeout'>((resolve) => {
                        timer = setTimeout(() => resolve('timeout'), nestedRequestTimeout);
                    })
                ]);
                if (completed === 'timeout') {
                    log(`[tsgo middleware] component completions timed out`);
                }
                return capture.result;
            } catch (error) {
                log(`[tsgo middleware] component completions failed: ${error}`);
                return undefined;
            } finally {
                clearTimeout(timer);
                nested.delete(key);
            }
        }
    };

    return {
        completion(
            result: CompletionResult,
            params: Pick<CompletionParams, 'textDocument' | 'position'>
        ): Promise<CompletionResult> | CompletionResult {
            const capture = nested.get(requestKey(params.textDocument.uri, params.position));
            if (capture) {
                capture.result = result;
                return result;
            }
            return transformCompletions(result, params, host);
        },
        resolve(item: CompletionItem): CompletionItem {
            // TS7 puts the file of the completion request into `data`
            const fileName = (item.data as { fileName?: string } | undefined)?.fileName;
            const document =
                fileName?.endsWith('.svelte') &&
                vscode.workspace.textDocuments.find((d) => d.uri.fsPath === fileName);
            return transformResolvedItem(
                item,
                toView(document || undefined),
                getImportEditOptions()
            );
        }
    };
}

function toView(doc: vscode.TextDocument | undefined): TextDocumentView | undefined {
    return (
        doc && {
            getText: () => doc.getText(),
            // vscode.TextDocument only accepts vscode.Position instances
            offsetAt: (position) =>
                doc.offsetAt(new vscode.Position(position.line, position.character)),
            positionAt: (offset) => doc.positionAt(offset)
        }
    );
}

/** Same setting the TS6 path uses for new script tags (`getNewScriptStartTag`) */
function getImportEditOptions(): ImportEditOptions {
    const lang = vscode.workspace
        .getConfiguration('svelte.plugin.svelte')
        .get<string>('defaultScriptLanguage', 'none');
    return { newScriptTag: lang && lang !== 'none' ? `<script lang="${lang}">` : '<script>' };
}

function requestKey(uri: string, position: { line: number; character: number }) {
    return `${vscode.Uri.parse(uri).toString()}|${position.line}:${position.character}`;
}
