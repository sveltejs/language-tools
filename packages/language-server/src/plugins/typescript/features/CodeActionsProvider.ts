import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Range,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    WorkspaceEdit,
} from 'vscode-languageserver';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { pathToUrl } from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { flatten } from '../../../utils';
import ts from 'typescript';

export class CodeActionsProviderImpl implements CodeActionsProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]> {
        if (context.only?.[0] === CodeActionKind.SourceOrganizeImports) {
            return await this.organizeImports(document);
        }

        if (
            context.diagnostics.length &&
            (!context.only || context.only.includes(CodeActionKind.QuickFix))
        ) {
            return await this.applyQuickfix(document, range, context);
        }

        if (!context.only || context.only.includes(CodeActionKind.Refactor)) {
            return await this.getApplicableRefactors(document, range);
        }

        return [];
    }

    private async organizeImports(document: Document): Promise<CodeAction[]> {
        if (!document.scriptInfo) {
            return [];
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const changes = lang.organizeImports({ fileName: tsDoc.filePath, type: 'file' }, {}, {});

        const documentChanges = await Promise.all(
            changes.map(async (change) => {
                // Organize Imports will only affect the current file, so no need to check the file path
                return TextDocumentEdit.create(
                    VersionedTextDocumentIdentifier.create(document.url, null),
                    change.textChanges.map((edit) => {
                        let range = mapRangeToOriginal(fragment, convertRange(fragment, edit.span));
                        // Handle svelte2tsx wrong import mapping:
                        // The character after the last import maps to the start of the script
                        // TODO find a way to fix this in svelte2tsx and then remove this
                        if (range.end.line === 0 && range.end.character === 1) {
                            edit.span.length -= 1;
                            range = mapRangeToOriginal(fragment, convertRange(fragment, edit.span));
                            range.end.character += 1;
                        }
                        return TextEdit.replace(range, edit.newText);
                    }),
                );
            }),
        );

        return [
            CodeAction.create(
                'Organize Imports',
                { documentChanges },
                CodeActionKind.SourceOrganizeImports,
            ),
        ];
    }

    private async applyQuickfix(document: Document, range: Range, context: CodeActionContext) {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const start = fragment.offsetAt(fragment.getGeneratedPosition(range.start));
        const end = fragment.offsetAt(fragment.getGeneratedPosition(range.end));
        const errorCodes: number[] = context.diagnostics.map((diag) => Number(diag.code));
        const codeFixes = lang.getCodeFixesAtPosition(
            tsDoc.filePath,
            start,
            end,
            errorCodes,
            {},
            {},
        );

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);
        return await Promise.all(
            codeFixes.map(async (fix) => {
                const documentChanges = await Promise.all(
                    fix.changes.map(async (change) => {
                        let doc = docs.get(change.fileName);
                        if (!doc) {
                            doc = await this.getSnapshot(change.fileName).getFragment();
                            docs.set(change.fileName, doc);
                        }
                        return TextDocumentEdit.create(
                            VersionedTextDocumentIdentifier.create(
                                pathToUrl(change.fileName),
                                null,
                            ),
                            change.textChanges.map((edit) => {
                                return TextEdit.replace(
                                    mapRangeToOriginal(doc!, convertRange(doc!, edit.span)),
                                    edit.newText,
                                );
                            }),
                        );
                    }),
                );
                return CodeAction.create(
                    fix.description,
                    {
                        documentChanges,
                    },
                    CodeActionKind.QuickFix,
                );
            }),
        );
    }

    private async getApplicableRefactors(document: Document, range: Range): Promise<CodeAction[]> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const textRange = {
            pos: fragment.offsetAt(fragment.getGeneratedPosition(range.start)),
            end: fragment.offsetAt(fragment.getGeneratedPosition(range.end)),
        };
        const applicableRefactors = lang.getApplicableRefactors(
            document.getFilePath() || '',
            textRange,
            undefined,
        );

        return (
            this.applicableRefactorsToCodeActions(applicableRefactors, document, textRange)
                // Only allow refactorings from which we know they work
                .filter(
                    (refactor) =>
                        refactor.command?.command.includes('function_scope') ||
                        refactor.command?.command.includes('constant_scope'),
                )
                // The language server also proposes extraction into const/function in module scope,
                // which is outside of the render function, which is svelte2tsx-specific and unmapped,
                // so it would both not work and confuse the user ("What is this render? Never declared that").
                // So filter out the module scope proposal and rename the render-title
                .filter((refactor) => !refactor.title.includes('module scope'))
                .map((refactor) => ({
                    ...refactor,
                    title: refactor.title
                        .replace(
                            `Extract to inner function in function 'render'`,
                            'Extract to function',
                        )
                        .replace(`Extract to constant in function 'render'`, 'Extract to constant'),
                }))
        );
    }

    private applicableRefactorsToCodeActions(
        applicableRefactors: ts.ApplicableRefactorInfo[],
        document: Document,
        textRange: { pos: number; end: number },
    ) {
        return flatten(
            applicableRefactors.map((applicableRefactor) => {
                if (applicableRefactor.inlineable === false) {
                    return [
                        CodeAction.create(applicableRefactor.description, {
                            title: applicableRefactor.description,
                            command: applicableRefactor.name,
                            arguments: [document.uri, textRange],
                        }),
                    ];
                }
                return applicableRefactor.actions.map((action) => {
                    return CodeAction.create(action.description, {
                        title: action.description,
                        command: action.name,
                        arguments: [document.uri, textRange],
                    });
                });
            }),
        );
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[],
    ): Promise<WorkspaceEdit | null> {
        if (!args || !args[1]) {
            return null;
        }

        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const path = document.getFilePath() || '';
        const range: ts.TextRange = args[1];

        const edits = lang.getEditsForRefactor(
            path,
            {},
            range,
            'Extract Symbol',
            command,
            undefined,
        );
        if (!edits || edits.edits.length === 0) {
            return null;
        }

        const documentChanges = edits?.edits.map((edit) =>
            TextDocumentEdit.create(
                VersionedTextDocumentIdentifier.create(document.uri, null),
                edit.textChanges.map((edit) => {
                    let range = mapRangeToOriginal(fragment, convertRange(fragment, edit.span));
                    // Some refactorings place the new code at the end of svelte2tsx' render function,
                    // which is unmapped. In this case, add it to the end of the script tag ourselves.
                    if (range.start.line < 0 || range.end.line < 0) {
                        // TODO could be module script tag -> find out
                        range = Range.create(
                            document.scriptInfo!.endPos,
                            document.scriptInfo!.endPos,
                        );
                    }
                    return TextEdit.replace(range, edit.newText);
                }),
            ),
        );

        return { documentChanges };
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
