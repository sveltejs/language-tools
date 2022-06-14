import ts from 'typescript';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    OptionalVersionedTextDocumentIdentifier,
    Range,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { importPrettier } from '../../../importPackage';
import {
    Document,
    getLineAtPosition,
    isAtEndOfLine,
    isRangeInTag,
    mapRangeToOriginal
} from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { flatten, getIndent, isNotNullOrUndefined, modifyLines, pathToUrl } from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { changeSvelteComponentName, convertRange } from '../utils';
import { CompletionsProviderImpl } from './CompletionProvider';
import { findContainingNode, isNoTextSpanInGeneratedCode, SnapshotMap } from './utils';

/**
 * TODO change this to protocol constant if it's part of the protocol
 */
export const SORT_IMPORT_CODE_ACTION_KIND = 'source.sortImports';

interface RefactorArgs {
    type: 'refactor';
    refactorName: string;
    textRange: ts.TextRange;
    originalRange: Range;
}

export class CodeActionsProviderImpl implements CodeActionsProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly completionProvider: CompletionsProviderImpl,
        private readonly configManager: LSConfigManager
    ) {}

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Promise<CodeAction[]> {
        if (context.only?.[0] === CodeActionKind.SourceOrganizeImports) {
            return await this.organizeImports(document, cancellationToken);
        }

        if (context.only?.[0] === SORT_IMPORT_CODE_ACTION_KIND) {
            return await this.organizeImports(
                document,
                cancellationToken,
                /**skipDestructiveCodeActions */ true
            );
        }

        // for source action command (all source.xxx)
        // vscode would show different source code action kinds to choose from
        if (context.only?.[0] === CodeActionKind.Source) {
            return [
                ...(await this.organizeImports(document, cancellationToken)),
                ...(await this.organizeImports(
                    document,
                    cancellationToken,
                    /**skipDestructiveCodeActions */ true
                ))
            ];
        }

        if (
            context.diagnostics.length &&
            (!context.only || context.only.includes(CodeActionKind.QuickFix))
        ) {
            return await this.applyQuickfix(document, range, context, cancellationToken);
        }

        if (!context.only || context.only.includes(CodeActionKind.Refactor)) {
            return await this.getApplicableRefactors(document, range, cancellationToken);
        }

        return [];
    }

    private async organizeImports(
        document: Document,
        cancellationToken: CancellationToken | undefined,
        skipDestructiveCodeActions = false
    ): Promise<CodeAction[]> {
        if (!document.scriptInfo && !document.moduleScriptInfo) {
            return [];
        }

        const { lang, tsDoc, userPreferences } = await this.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested || tsDoc.parserError) {
            // If there's a parser error, we fall back to only the script contents,
            // so organize imports likely throws out a lot of seemingly unused imports
            // because they are only used in the template. Therefore do nothing in this case.
            return [];
        }

        const useSemicolons =
            this.configManager.getMergedPrettierConfig(
                await importPrettier(document.getFilePath()!).resolveConfig(
                    document.getFilePath()!,
                    {
                        editorconfig: true
                    }
                )
            ).semi ?? true;
        const changes = lang.organizeImports(
            {
                fileName: tsDoc.filePath,
                type: 'file',
                skipDestructiveCodeActions
            },
            {
                semicolons: useSemicolons
                    ? ts.SemicolonPreference.Insert
                    : ts.SemicolonPreference.Remove
            },
            userPreferences
        );

        const documentChanges = await Promise.all(
            changes.map(async (change) => {
                // Organize Imports will only affect the current file, so no need to check the file path
                return TextDocumentEdit.create(
                    OptionalVersionedTextDocumentIdentifier.create(document.url, null),
                    change.textChanges.map((edit) => {
                        const range = this.checkRemoveImportCodeActionRange(
                            edit,
                            tsDoc,
                            mapRangeToOriginal(tsDoc, convertRange(tsDoc, edit.span))
                        );

                        return this.fixIndentationOfImports(
                            TextEdit.replace(range, edit.newText),
                            document
                        );
                    })
                );
            })
        );

        return [
            CodeAction.create(
                skipDestructiveCodeActions ? 'Sort Imports' : 'Organize Imports',
                { documentChanges },
                skipDestructiveCodeActions
                    ? SORT_IMPORT_CODE_ACTION_KIND
                    : CodeActionKind.SourceOrganizeImports
            )
        ];
    }

    private fixIndentationOfImports(edit: TextEdit, document: Document): TextEdit {
        // "Organize Imports" will have edits that delete a group of imports by return empty edits
        // and one edit which contains all the organized imports of the group. Fix indentation
        // of that one by prepending all lines with the indentation of the first line.
        const { newText, range } = edit;
        if (!newText || range.start.character === 0) {
            return edit;
        }

        const line = getLineAtPosition(range.start, document.getText());
        const leadingChars = line.substring(0, range.start.character);
        if (leadingChars.trim() !== '') {
            return edit;
        }

        const fixedNewText = modifyLines(edit.newText, (line, idx) =>
            idx === 0 || !line ? line : leadingChars + line
        );

        if (range.end.character > 0) {
            const endLine = getLineAtPosition(range.start, document.getText());
            const isIndent = !endLine.substring(0, range.start.character).trim();

            if (isIndent && endLine.trim()) {
                range.end.character = 0;
            }
        }

        return TextEdit.replace(range, fixedNewText);
    }

    private checkRemoveImportCodeActionRange(
        edit: ts.TextChange,
        snapshot: DocumentSnapshot,
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
            range = mapRangeToOriginal(snapshot, convertRange(snapshot, edit.span));

            if (!(snapshot instanceof SvelteDocumentSnapshot)) {
                range.end.character += 1;
                return range;
            }

            const line = getLineAtPosition(range.end, snapshot.getOriginalText());
            // remove-import code action will removes the
            // line break generated by svelte2tsx,
            // but when there's no line break in the source
            // move back to next character would remove the next character
            if ([';', '"', "'"].includes(line[range.end.character])) {
                range.end.character += 1;
            }

            if (isAtEndOfLine(line, range.end.character)) {
                range.end.line += 1;
                range.end.character = 0;
            }
        }

        return range;
    }

    private async applyQuickfix(
        document: Document,
        range: Range,
        context: CodeActionContext,
        cancellationToken: CancellationToken | undefined
    ) {
        const { lang, tsDoc, userPreferences } = await this.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        const start = tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.start));
        const end = tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.end));
        const errorCodes: number[] = context.diagnostics.map((diag) => Number(diag.code));
        let codeFixes = errorCodes.includes(2304) // "Cannot find name '...'."
            ? this.getComponentImportQuickFix(start, end, lang, tsDoc.filePath, userPreferences)
            : undefined;
        codeFixes =
            // either-or situation
            codeFixes ||
            lang.getCodeFixesAtPosition(
                tsDoc.filePath,
                start,
                end,
                errorCodes,
                {},
                userPreferences
            );

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);

        const codeActionsPromises = codeFixes.map(async (fix) => {
            const documentChangesPromises = fix.changes.map(async (change) => {
                const snapshot = await snapshots.retrieve(change.fileName);
                return TextDocumentEdit.create(
                    OptionalVersionedTextDocumentIdentifier.create(
                        pathToUrl(change.fileName),
                        null
                    ),
                    change.textChanges
                        .map((edit) => {
                            if (
                                fix.fixName === 'import' &&
                                snapshot instanceof SvelteDocumentSnapshot
                            ) {
                                return this.completionProvider.codeActionChangeToTextEdit(
                                    document,
                                    snapshot,
                                    edit,
                                    true,
                                    range.start
                                );
                            }

                            if (!isNoTextSpanInGeneratedCode(snapshot.getFullText(), edit.span)) {
                                return undefined;
                            }

                            let originalRange = mapRangeToOriginal(
                                snapshot,
                                convertRange(snapshot, edit.span)
                            );

                            if (fix.fixName === 'unusedIdentifier') {
                                originalRange = this.checkRemoveImportCodeActionRange(
                                    edit,
                                    snapshot,
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

                            if (fix.fixName === 'disableJsDiagnostics') {
                                if (edit.newText.includes('ts-nocheck')) {
                                    return this.checkTsNoCheckCodeInsert(document, edit);
                                }

                                return this.checkDisableJsDiagnosticsCodeInsert(
                                    originalRange,
                                    document,
                                    edit
                                );
                            }

                            if (originalRange.start.line < 0 || originalRange.end.line < 0) {
                                return undefined;
                            }

                            return TextEdit.replace(originalRange, edit.newText);
                        })
                        .filter(isNotNullOrUndefined)
                );
            });
            const documentChanges = await Promise.all(documentChangesPromises);
            return CodeAction.create(
                fix.description,
                {
                    documentChanges
                },
                CodeActionKind.QuickFix
            );
        });

        const codeActions = await Promise.all(codeActionsPromises);

        // filter out empty code action
        return codeActions.filter((codeAction) =>
            codeAction.edit?.documentChanges?.every(
                (change) => (<TextDocumentEdit>change).edits.length > 0
            )
        );
    }

    /**
     * import quick fix requires the symbol name to be the same as where it's defined.
     * But we have suffix on component default export to prevent conflict with
     * a local variable. So we use auto-import completion as a workaround here.
     */
    private getComponentImportQuickFix(
        start: number,
        end: number,
        lang: ts.LanguageService,
        filePath: string,
        userPreferences: ts.UserPreferences
    ): readonly ts.CodeFixAction[] | undefined {
        const sourceFile = lang.getProgram()?.getSourceFile(filePath);

        if (!sourceFile) {
            return;
        }

        const node = findContainingNode(
            sourceFile,
            {
                start,
                length: end - start
            },
            (node): node is ts.JsxOpeningLikeElement | ts.JsxClosingElement | ts.Identifier =>
                this.configManager.getConfig().svelte.useNewTransformation
                    ? ts.isCallExpression(node.parent) &&
                      ts.isIdentifier(node.parent.expression) &&
                      node.parent.expression.text === '__sveltets_2_ensureComponent' &&
                      ts.isIdentifier(node)
                    : ts.isJsxClosingElement(node) || ts.isJsxOpeningLikeElement(node)
        );

        if (!node) {
            return;
        }

        const tagName = ts.isIdentifier(node) ? node : node.tagName;
        const completion = lang.getCompletionsAtPosition(
            filePath,
            tagName.getEnd(),
            userPreferences
        );

        if (!completion) {
            return;
        }

        const name = tagName.getText();
        const suffixedName = name + '__SvelteComponent_';
        const errorPreventingUserPreferences =
            this.completionProvider.fixUserPreferencesForSvelteComponentImport(userPreferences);

        const toFix = (c: ts.CompletionEntry) =>
            lang
                .getCompletionEntryDetails(
                    filePath,
                    end,
                    c.name,
                    {},
                    c.source,
                    errorPreventingUserPreferences,
                    c.data
                )
                ?.codeActions?.map((a) => ({
                    ...a,
                    description: changeSvelteComponentName(a.description),
                    fixName: 'import'
                })) ?? [];

        return flatten(
            completion.entries.filter((c) => c.name === name || c.name === suffixedName).map(toFix)
        );
    }

    private async getApplicableRefactors(
        document: Document,
        range: Range,
        cancellationToken: CancellationToken | undefined
    ): Promise<CodeAction[]> {
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

        const { lang, tsDoc, userPreferences } = await this.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        const textRange = {
            pos: tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.start)),
            end: tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.end))
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
                        refactor.command?.command.includes('constant_scope') ||
                        refactor.command?.command === 'Infer function return type'
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

        const { lang, tsDoc, userPreferences } = await this.getLSAndTSDoc(document);
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
                OptionalVersionedTextDocumentIdentifier.create(document.uri, null),
                edit.textChanges.map((edit) => {
                    const range = mapRangeToOriginal(tsDoc, convertRange(tsDoc, edit.span));

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
            if (isRangeInTag(targetRange, document.moduleScriptInfo)) {
                return Range.create(
                    document.moduleScriptInfo.endPos,
                    document.moduleScriptInfo.endPos
                );
            }

            if (document.scriptInfo) {
                return Range.create(document.scriptInfo.endPos, document.scriptInfo.endPos);
            }
        }

        return resultRange;
    }

    private checkTsNoCheckCodeInsert(
        document: Document,
        edit: ts.TextChange
    ): TextEdit | undefined {
        if (!document.scriptInfo) {
            return undefined;
        }

        const newText = ts.sys.newLine + edit.newText;

        return TextEdit.insert(document.scriptInfo.startPos, newText);
    }

    private checkDisableJsDiagnosticsCodeInsert(
        originalRange: Range,
        document: Document,
        edit: ts.TextChange
    ): TextEdit {
        const startOffset = document.offsetAt(originalRange.start);
        const text = document.getText();

        // svetlte2tsx removes export in instance script
        const insertedAfterExport = text.slice(0, startOffset).trim().endsWith('export');

        if (!insertedAfterExport) {
            return TextEdit.replace(originalRange, edit.newText);
        }

        const position = document.positionAt(text.lastIndexOf('export', startOffset));

        // fix the length of trailing indent
        const linesOfNewText = edit.newText.split('\n');
        if (/^[ \t]*$/.test(linesOfNewText[linesOfNewText.length - 1])) {
            const line = getLineAtPosition(originalRange.start, document.getText());
            const indent = getIndent(line);
            linesOfNewText[linesOfNewText.length - 1] = indent;
        }

        return TextEdit.insert(position, linesOfNewText.join('\n'));
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
