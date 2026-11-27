import type {
    CodeAction,
    Command,
    TextEdit,
    WorkspaceEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { fixImportTextEdits, ImportEditOptions } from './importEdits';
import type { TextDocumentView } from './utils';

export type CodeActionResult = Array<Command | CodeAction> | null;

const componentName = /\b([A-Za-z_$][\w$]*)__SvelteComponent_\b/g;

/**
 * TS7's code actions for a Svelte file. As of 7.1 its quick fixes are the import fixes ("Add import
 * from …", "Add all missing imports"; also in `.ts` files nothing else is offered). Like the
 * completion auto-imports they
 * - name components `X__SvelteComponent_` (the default export svelte2tsx generates), and
 * - indent the import with TS7's format options, not like the script, or put it outside the
 *   script if there is no usable one (`fixImportTextEdits`).
 */
export function transformCodeActions(
    result: CodeActionResult,
    uri: string,
    document: TextDocumentView | undefined,
    options: ImportEditOptions
): CodeActionResult {
    if (!result) {
        return result;
    }
    return result.map((action) =>
        isCodeAction(action) ? transformCodeAction(action, uri, document, options) : action
    );
}

function isCodeAction(action: Command | CodeAction): action is CodeAction {
    return typeof (action as Command).command !== 'string';
}

function transformCodeAction(
    action: CodeAction,
    uri: string,
    document: TextDocumentView | undefined,
    options: ImportEditOptions
): CodeAction {
    const title = action.title.replace(componentName, '$1');
    const edit = action.edit && transformWorkspaceEdit(action.edit, uri, document, options);
    return title === action.title && edit === action.edit ? action : { ...action, title, edit };
}

function transformWorkspaceEdit(
    edit: WorkspaceEdit,
    uri: string,
    document: TextDocumentView | undefined,
    options: ImportEditOptions
): WorkspaceEdit {
    const fixEdits = (editUri: string, edits: readonly TextEdit[]): TextEdit[] => {
        const renamed = edits.map((e) => {
            const newText = e.newText.replace(componentName, '$1');
            return newText === e.newText ? e : { ...e, newText };
        });
        // only the document the request was for is known here
        return document && sameUri(editUri, uri)
            ? fixImportTextEdits(renamed, document, options)
            : renamed;
    };

    let changes = edit.changes;
    if (changes) {
        changes = Object.fromEntries(
            Object.entries(changes).map(([editUri, edits]) => [editUri, fixEdits(editUri, edits)])
        );
    }
    let documentChanges = edit.documentChanges;
    if (documentChanges) {
        documentChanges = documentChanges.map((change) =>
            'textDocument' in change && 'edits' in change
                ? {
                      ...change,
                      edits: fixEdits(change.textDocument.uri, change.edits as TextEdit[])
                  }
                : change
        );
    }
    return { ...edit, changes, documentChanges };
}

function sameUri(a: string, b: string) {
    return a === b || safeDecode(a) === safeDecode(b);
}

function safeDecode(uri: string) {
    try {
        return decodeURIComponent(uri);
    } catch {
        return uri;
    }
}
