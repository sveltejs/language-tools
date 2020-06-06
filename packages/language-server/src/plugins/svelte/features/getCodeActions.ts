import {
    Diagnostic,
    CodeActionContext,
    CodeAction,
    TextEdit,
    TextDocumentEdit,
    Position,
    CodeActionKind,
    VersionedTextDocumentIdentifier,
    DiagnosticSeverity
} from 'vscode-languageserver';
import { EOL } from 'os';
import { SvelteDocument } from '../SvelteDocument';
import { pathToUrl } from '../../../utils';

export function getCodeActions(svelteDoc: SvelteDocument, context: CodeActionContext) {
    const svelteDiagnostics = context.diagnostics
        .filter(isIgnorableSvelteDiagnostic);

    return svelteDiagnostics.map(diagnostic => {
        const textDocument = VersionedTextDocumentIdentifier.create(
            pathToUrl(svelteDoc.getFilePath()),
            svelteDoc.version
        );

        return CodeAction.create(getCodeActionTitle(diagnostic), {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    getSvelteIgnoreEdit(svelteDoc, diagnostic)
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

function isIgnorableSvelteDiagnostic(diagnostic: Diagnostic) {
    const { source, severity, code } = diagnostic;
    return code && source === 'svelte' &&
        severity !== DiagnosticSeverity.Error;
}

function getSvelteIgnoreEdit(svelteDoc: SvelteDocument, diagnostic: Diagnostic) {
    const { code, range: { start } } = diagnostic;
    const content = svelteDoc.getText();
    const startLineStart = svelteDoc.offsetAt({ line: start.line, character: 0 });
    const afterStartLineStart = content.slice(startLineStart);
    const indent = /^[ |\t]+/.exec(afterStartLineStart)?.[0] ?? '';

    // TODO: Make all code action's new line consistent
    const ignore = `${indent}<!-- svelte-ignore ${code} -->${EOL}`;
    const position = Position.create(start.line, 0);

    return TextEdit.insert(position, ignore);
}
