import {
    Diagnostic,
    CodeActionContext,
    CodeAction,
    TextEdit,
    TextDocumentEdit,
    Position,
    CodeActionKind,
    VersionedTextDocumentIdentifier
} from 'vscode-languageserver';
import { EOL } from 'os';
import { Document } from '../../../lib/documents';

export function getCodeActions(document: Document, context: CodeActionContext) {
    const svelteDiagnostics = context.diagnostics
        .filter(diagnostic => diagnostic.source === 'svelte');
    return svelteDiagnostics.map(diagnostic => {
        const textDocument = VersionedTextDocumentIdentifier.create(
            document.uri,
            document.version
        );

        return CodeAction.create(getCodeActionTitle(diagnostic), {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    getSvelteIgnoreEdit(diagnostic)
                ])
            ]
        },
            CodeActionKind.QuickFix);
    });
}

function getCodeActionTitle(diagnostic: Diagnostic) {
    // make it distinguishable with eslint's code action
    return `(svelte) Disable ${diagnostic.code} for this line`;
}

function getSvelteIgnoreEdit(diagnostic: Diagnostic) {
    const { code, range: { start } } = diagnostic;

    // TODO: Make all code action's new line consistent
    const ignore = `<!-- svelte-ignore ${code} -->${EOL}`;
    const position = Position.create(start.line, start.character);

    return TextEdit.insert(position, ignore);
}
