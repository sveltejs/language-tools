import * as vscode from 'vscode';
import type { TextDocumentView } from './utils';

/**
 * The open document of `uri`, as the view the vscode-independent parts of the middleware work on.
 *
 * Documents are looked up by their normalized uri. What we get from TS7 can't be compared with
 * VS Code's uris and paths as is: LSP uris are percent-encoded differently (`%2Bpage.svelte`), and
 * TS7's file names have forward slashes where `fsPath` has backslashes on Windows
 * (`c:/src/App.svelte` vs. `c:\src\App.svelte`). Pass `vscode.Uri.parse(lspUri)` or
 * `vscode.Uri.file(tsFileName)`.
 */
export function getOpenDocument(uri: vscode.Uri): TextDocumentView | undefined {
    const key = uri.toString();
    const document = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    return (
        document && {
            getText: () => document.getText(),
            // vscode.TextDocument only accepts vscode.Position instances
            offsetAt: (position) =>
                document.offsetAt(new vscode.Position(position.line, position.character)),
            positionAt: (offset) => document.positionAt(offset)
        }
    );
}
