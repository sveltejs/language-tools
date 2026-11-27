import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    TextEdit
} from 'vscode-languageserver-types';
import { Document } from '../../../lib/documents';
import type { Node } from 'vscode-html-languageservice';

/**
 * "Add lang="ts" to <script> tag" for TS7's "can only be used in TypeScript files" diagnostics
 * (8004–8017), in content mapper mode. Needs no type information: a port of
 * `CodeActionsProviderImpl.getAddLangTSCodeAction` (TS6 mode), which TS7 doesn't offer.
 */
export function getAddLangTsCodeAction(
    document: Document,
    context: CodeActionContext
): CodeAction | undefined {
    if (
        isTypeScript(document.scriptInfo?.attributes) ||
        isTypeScript(document.moduleScriptInfo?.attributes)
    ) {
        return;
    }
    const hasTsOnlyDiagnostic = context.diagnostics.some((diagnostic) => {
        const code = Number(diagnostic.code);
        return code >= 8004 && code <= 8017;
    });
    if (!hasTsOnlyDiagnostic) {
        return;
    }

    const create = (title: string, edits: TextEdit[]) =>
        CodeAction.create(
            title,
            {
                documentChanges: [
                    {
                        textDocument: OptionalVersionedTextDocumentIdentifier.create(
                            document.uri,
                            null
                        ),
                        edits
                    }
                ]
            },
            CodeActionKind.QuickFix
        );

    if (!document.scriptInfo && !document.moduleScriptInfo) {
        // might be an issue with parsing the script tag, so don't suggest adding a new one
        if (document.html.roots.some(hasLangTsScriptTag)) {
            return;
        }
        const newLine = document.getText().includes('\r\n') ? '\r\n' : '\n';
        return create('Add <script lang="ts"> tag', [
            TextEdit.insert(Position.create(0, 0), '<script lang="ts"></script>' + newLine)
        ]);
    }

    const edits = [document.scriptInfo, document.moduleScriptInfo].flatMap((info) => {
        if (!info) {
            return [];
        }
        const startTagNameEnd = document.positionAt(info.container.start + '<script'.length);
        const attributes = document.getText({
            start: startTagNameEnd,
            end: document.positionAt(info.start)
        });
        if (attributes.includes('lang=')) {
            return [];
        }
        return [TextEdit.insert(startTagNameEnd, ' lang="ts"')];
    });
    return edits.length ? create('Add lang="ts" to <script> tag', edits) : undefined;
}

function isTypeScript(attributes: Record<string, string> | undefined) {
    return attributes?.lang === 'ts' || attributes?.lang === 'typescript';
}

function hasLangTsScriptTag(node: Node): boolean {
    if (
        node.tag === 'script' &&
        (node.attributes?.lang === '"ts"' || node.attributes?.lang === "'ts'") &&
        node.parent
    ) {
        return true;
    }
    return node.children.some(hasLangTsScriptTag);
}
