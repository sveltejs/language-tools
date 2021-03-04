import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Range,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    WorkspaceEdit
} from 'vscode-languageserver';
import { Document, mapRangeToOriginal, isRangeInTag, isInTag } from '../../../lib/documents';
import { pathToUrl, flatten, isNotNullOrUndefined } from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { SnapshotFragment, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';

import ts from 'typescript';
import { CompletionsProviderImpl } from './CompletionProvider';
import { isNoTextSpanInGeneratedCode, SnapshotFragmentMap } from './utils';

interface RefactorArgs {
    type: 'refactor';
    refactorName: string;
    textRange: ts.TextRange;
    originalRange: Range;
}

export class CodeActionsProviderImpl implements CodeActionsProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly completionProvider: CompletionsProviderImpl
    ) {}

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
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
        if (!document.scriptInfo && !document.moduleScriptInfo) {
            return [];
        }

        const { lang, tsDoc, userPreferences } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const changes = lang.organizeImports(
            {
                fileName: tsDoc.filePath,
                type: 'file'
            },
            {},
            userPreferences
        );

        const documentChanges = await Promise.all(
            changes.map(async (change) => {
                // Organize Imports will only affect the current file, so no need to check the file path
                return TextDocumentEdit.create(
                    VersionedTextDocumentIdentifier.create(document.url, 0),
                    change.textChanges.map((edit) => {
                        const range = this.checkRemoveImportCodeActionRange(
                            edit,
                            fragment,
                            mapRangeToOriginal(fragment, convertRange(fragment, edit.span))
                        );

                        return TextEdit.replace(range, edit.newText);
                    })
                );
            })
        );

        return [
            CodeAction.create(
                'Organize Imports',
                { documentChanges },
                CodeActionKind.SourceOrganizeImports
            )
        ];
    }

    private checkRemoveImportCodeActionRange(
        edit: ts.TextChange,
        fragment: SnapshotFragment,
        range: Range
    ) {
        // Handle svelte2tsx wrong import mapping:
        // The character after the last import maps to the start of the script
        // TODO find a way to fix this in svelte2tsx and then remove this
        if (
            (range.end.line === 0 && range.end.character === 1) ||
            range.end.line < range.start.line
        ) {
            edit.span.length -= 1;
            range = mapRangeToOriginal(fragment, convertRange(fragment, edit.span));
            range.end.character += 1;
        }

        return range;
    }

    private async applyQuickfix(document: Document, range: Range, context: CodeActionContext) {
        const { lang, tsDoc, userPreferences } = this.getLSAndTSDoc(document);
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
            userPreferences
        );

        const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
        docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });

        return await Promise.all(
            codeFixes.map(async (fix) => {
                const documentChanges = await Promise.all(
                    fix.changes.map(async (change) => {
                        const { snapshot, fragment } = await docs.retrieve(change.fileName);
                        return TextDocumentEdit.create(
                            VersionedTextDocumentIdentifier.create(pathToUrl(change.fileName), 0),
                            change.textChanges
                                .map((edit) => {
                                    if (
                                        fix.fixName === 'import' &&
                                        fragment instanceof SvelteSnapshotFragment
                                    ) {
                                        return this.completionProvider.codeActionChangeToTextEdit(
                                            document,
                                            fragment,
                                            edit,
                                            true,
                                            isInTag(range.start, document.scriptInfo) ||
                                                isInTag(range.start, document.moduleScriptInfo)
                                        );
                                    }

                                    if (
                                        !isNoTextSpanInGeneratedCode(
                                            snapshot.getFullText(),
                                            edit.span
                                        )
                                    ) {
                                        return undefined;
                                    }

                                    let originalRange = mapRangeToOriginal(
                                        fragment,
                                        convertRange(fragment, edit.span)
                                    );

                                    if (fix.fixName === 'unusedIdentifier') {
                                        originalRange = this.checkRemoveImportCodeActionRange(
                                            edit,
                                            fragment,
                                            originalRange
                                        );
                                    }

                                    if (fix.fixName === 'fixMissingFunctionDeclaration') {
                                        originalRange = this.checkEndOfFileCodeInsert(
                                            originalRange,
                                            range,
                                            document
                                        );
                                    }

                                    return TextEdit.replace(originalRange, edit.newText);
                                })
                                .filter(isNotNullOrUndefined)
                        );
                    })
                );
                return CodeAction.create(
                    fix.description,
                    {
                        documentChanges
                    },
                    CodeActionKind.QuickFix
                );
            })
        );
    }

    private async getApplicableRefactors(document: Document, range: Range): Promise<CodeAction[]> {
        if (
            !isRangeInTag(range, document.scriptInfo) &&
            !isRangeInTag(range, document.moduleScriptInfo)
        ) {
            return [];
        }

        // Don't allow refactorings when there is likely a store subscription.
        // Reason: Extracting that would lead to svelte2tsx' transformed store representation
        // showing up, which will confuse the user. In the long run, we maybe have to
        // setup a separate ts language service which only knows of the original script.
        const textInRange = document
            .getText()
            .substring(document.offsetAt(range.start), document.offsetAt(range.end));
        if (textInRange.includes('$')) {
            return [];
        }

        const { lang, tsDoc, userPreferences } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const textRange = {
            pos: fragment.offsetAt(fragment.getGeneratedPosition(range.start)),
            end: fragment.offsetAt(fragment.getGeneratedPosition(range.end))
        };
        const applicableRefactors = lang.getApplicableRefactors(
            document.getFilePath() || '',
            textRange,
            userPreferences
        );

        return (
            this.applicableRefactorsToCodeActions(applicableRefactors, document, range, textRange)
                // Only allow refactorings from which we know they work
                .filter(
                    (refactor) =>
                        refactor.command?.command.includes('function_scope') ||
                        refactor.command?.command.includes('constant_scope')
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
                            "Extract to inner function in function 'render'",
                            'Extract to function'
                        )
                        .replace("Extract to constant in function 'render'", 'Extract to constant')
                }))
        );
    }

    private applicableRefactorsToCodeActions(
        applicableRefactors: ts.ApplicableRefactorInfo[],
        document: Document,
        originalRange: Range,
        textRange: { pos: number; end: number }
    ) {
        return flatten(
            applicableRefactors.map((applicableRefactor) => {
                if (applicableRefactor.inlineable === false) {
                    return [
                        CodeAction.create(applicableRefactor.description, {
                            title: applicableRefactor.description,
                            command: applicableRefactor.name,
                            arguments: [
                                document.uri,
                                <RefactorArgs>{
                                    type: 'refactor',
                                    textRange,
                                    originalRange,
                                    refactorName: 'Extract Symbol'
                                }
                            ]
                        })
                    ];
                }

                return applicableRefactor.actions.map((action) => {
                    return CodeAction.create(action.description, {
                        title: action.description,
                        command: action.name,
                        arguments: [
                            document.uri,
                            <RefactorArgs>{
                                type: 'refactor',
                                textRange,
                                originalRange,
                                refactorName: applicableRefactor.name
                            }
                        ]
                    });
                });
            })
        );
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | null> {
        if (!(args?.[1]?.type === 'refactor')) {
            return null;
        }

        const { lang, tsDoc, userPreferences } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();
        const path = document.getFilePath() || '';
        const { refactorName, originalRange, textRange } = <RefactorArgs>args[1];

        const edits = lang.getEditsForRefactor(
            path,
            {},
            textRange,
            refactorName,
            command,
            userPreferences
        );
        if (!edits || edits.edits.length === 0) {
            return null;
        }

        const documentChanges = edits?.edits.map((edit) =>
            TextDocumentEdit.create(
                VersionedTextDocumentIdentifier.create(document.uri, 0),
                edit.textChanges.map((edit) => {
                    const range = mapRangeToOriginal(fragment, convertRange(fragment, edit.span));

                    return TextEdit.replace(
                        this.checkEndOfFileCodeInsert(range, originalRange, document),
                        edit.newText
                    );
                })
            )
        );

        return { documentChanges };
    }

    /**
     * Some refactorings place the new code at the end of svelte2tsx' render function,
     *  which is unmapped. In this case, add it to the end of the script tag ourselves.
     */
    private checkEndOfFileCodeInsert(resultRange: Range, targetRange: Range, document: Document) {
        if (resultRange.start.line < 0 || resultRange.end.line < 0) {
            if (isRangeInTag(targetRange, document.scriptInfo)) {
                resultRange = Range.create(document.scriptInfo.endPos, document.scriptInfo.endPos);
            } else if (isRangeInTag(targetRange, document.moduleScriptInfo)) {
                resultRange = Range.create(
                    document.moduleScriptInfo.endPos,
                    document.moduleScriptInfo.endPos
                );
            }
        }
        return resultRange;
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
