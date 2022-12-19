import ts from 'typescript';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Diagnostic,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import {
    Document,
    getLineAtPosition,
    isAtEndOfLine,
    isInTag,
    isRangeInTag,
    mapRangeToOriginal
} from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import {
    flatten,
    getIndent,
    isNotNullOrUndefined,
    modifyLines,
    pathToUrl,
    possiblyComponent
} from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { changeSvelteComponentName, convertRange } from '../utils';
import { CompletionsProviderImpl } from './CompletionProvider';
import {
    findContainingNode,
    FormatCodeBasis,
    getFormatCodeBasis,
    getQuotePreference,
    isTextSpanInGeneratedCode,
    SnapshotMap
} from './utils';

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

        const changes = lang.organizeImports(
            {
                fileName: tsDoc.filePath,
                type: 'file',
                skipDestructiveCodeActions
            },
            {
                ...(await this.configManager.getFormatCodeSettingsForFile(
                    document,
                    tsDoc.scriptKind
                )),

                // handle it on our own
                baseIndentSize: undefined
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
            const endLine = getLineAtPosition(range.end, document.getText());
            const isIndent = !endLine.substring(0, range.end.character).trim();

            if (isIndent) {
                const trimmedEndLine = endLine.trim();

                // imports that would be removed by the next delete edit
                if (trimmedEndLine && !trimmedEndLine.startsWith('import')) {
                    range.end.character = 0;
                }
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
        const cannotFoundNameDiagnostic = context.diagnostics.filter(
            (diagnostic) => diagnostic.code === 2304
        ); // "Cannot find name '...'."

        const formatCodeSettings = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );
        const formatCodeBasis = getFormatCodeBasis(formatCodeSettings);

        let codeFixes = cannotFoundNameDiagnostic.length
            ? this.getComponentImportQuickFix(
                  start,
                  end,
                  lang,
                  tsDoc,
                  userPreferences,
                  cannotFoundNameDiagnostic,
                  formatCodeSettings
              )
            : undefined;
        codeFixes =
            // either-or situation
            codeFixes ||
            lang
                .getCodeFixesAtPosition(
                    tsDoc.filePath,
                    start,
                    end,
                    errorCodes,
                    formatCodeSettings,
                    userPreferences
                )
                .concat(
                    await this.getSvelteQuickFixes(
                        lang,
                        document,
                        cannotFoundNameDiagnostic,
                        tsDoc,
                        formatCodeBasis,
                        userPreferences
                    )
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

                            if (isTextSpanInGeneratedCode(snapshot.getFullText(), edit.span)) {
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

                                // ts doesn't add base indent to the first line
                                if (formatCodeSettings.baseIndentSize) {
                                    const emptyLine = formatCodeBasis.newLine.repeat(2);
                                    edit.newText =
                                        emptyLine +
                                        formatCodeBasis.baseIndent +
                                        edit.newText.trimLeft();
                                }
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

                            if (fix.fixName === 'inferFromUsage') {
                                originalRange = this.checkAddJsDocCodeActionRange(
                                    snapshot,
                                    originalRange,
                                    document
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
        tsDoc: DocumentSnapshot,
        userPreferences: ts.UserPreferences,
        diagnostics: Diagnostic[],
        formatCodeSetting: ts.FormatCodeSettings
    ): readonly ts.CodeFixAction[] | undefined {
        const sourceFile = lang.getProgram()?.getSourceFile(tsDoc.filePath);

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
        const tagNameEnd = tagName.getEnd();
        const tagNameEndOriginalPosition = tsDoc.offsetAt(
            tsDoc.getOriginalPosition(tsDoc.positionAt(tagNameEnd))
        );
        const name = tagName.getText();
        if (!possiblyComponent(name)) {
            return;
        }

        const hasDiagnosticForTag = diagnostics.some(
            ({ range }) =>
                tsDoc.offsetAt(range.start) <= tagNameEndOriginalPosition &&
                tagNameEndOriginalPosition <= tsDoc.offsetAt(range.end)
        );

        if (!hasDiagnosticForTag) {
            return;
        }

        const completion = lang.getCompletionsAtPosition(
            tsDoc.filePath,
            tagNameEnd,
            userPreferences,
            formatCodeSetting
        );

        if (!completion) {
            return;
        }

        const suffixedName = name + '__SvelteComponent_';
        const errorPreventingUserPreferences =
            this.completionProvider.fixUserPreferencesForSvelteComponentImport(userPreferences);

        const toFix = (c: ts.CompletionEntry) =>
            lang
                .getCompletionEntryDetails(
                    tsDoc.filePath,
                    end,
                    c.name,
                    formatCodeSetting,
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

    /**
     * Workaround for TypeScript doesn't provide a quick fix if the signature is typed as union type, like `(() => void) | null`
     * We can remove this once TypeScript doesn't have this limitation.
     */
    private async getSvelteQuickFixes(
        lang: ts.LanguageService,
        document: Document,
        diagnostics: Diagnostic[],
        tsDoc: DocumentSnapshot,
        formatCodeBasis: FormatCodeBasis,
        userPreferences: ts.UserPreferences
    ): Promise<ts.CodeFixAction[]> {
        const program = lang.getProgram();
        const sourceFile = program?.getSourceFile(tsDoc.filePath);
        if (!program || !sourceFile) {
            return [];
        }

        const typeChecker = program.getTypeChecker();
        const results: ts.CodeFixAction[] = [];
        const quote = getQuotePreference(sourceFile, userPreferences);

        for (const diagnostic of diagnostics) {
            const start = tsDoc.offsetAt(tsDoc.getGeneratedPosition(diagnostic.range.start));
            const end = tsDoc.offsetAt(tsDoc.getGeneratedPosition(diagnostic.range.end));

            const identifier = findContainingNode(
                sourceFile,
                { start, length: end - start },
                ts.isIdentifier
            );

            if (!identifier) {
                continue;
            }

            const isQuickFixTargetTargetStore = identifier?.escapedText.toString().startsWith('$');
            const isQuickFixTargetEventHandler = this.isQuickFixForEventHandler(
                document,
                diagnostic
            );

            if (isQuickFixTargetTargetStore) {
                results.push(
                    ...(await this.getSvelteStoreQuickFixes(
                        identifier,
                        lang,
                        document,
                        tsDoc,
                        userPreferences
                    ))
                );
            }

            if (isQuickFixTargetEventHandler) {
                results.push(
                    ...this.getEventHandlerQuickFixes(
                        identifier,
                        tsDoc,
                        typeChecker,
                        quote,
                        formatCodeBasis
                    )
                );
            }
        }

        return results;
    }

    private async getSvelteStoreQuickFixes(
        identifier: ts.Identifier,
        lang: ts.LanguageService,
        document: Document,
        tsDoc: DocumentSnapshot,
        userPreferences: ts.UserPreferences
    ): Promise<ts.CodeFixAction[]> {
        const storeIdentifier = identifier.escapedText.toString().substring(1);
        //const storeResults = lang.getNavigateToItems(storeIdentifier as string, 10);

        const formatCodeSettings = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );

        const completion = lang.getCompletionsAtPosition(
            tsDoc.filePath,
            0,
            userPreferences,
            formatCodeSettings
        );

        if (!completion) {
            return [];
        }

        const toFix = (c: ts.CompletionEntry) =>
            lang
                .getCompletionEntryDetails(
                    tsDoc.filePath,
                    0,
                    c.name,
                    formatCodeSettings,
                    c.source,
                    userPreferences,
                    c.data
                )
                ?.codeActions?.map((a) => ({
                    ...a,
                    fixName: 'import'
                })) ?? [];

        return flatten(completion.entries.filter((c) => c.name === storeIdentifier).map(toFix));
    }

    private getEventHandlerQuickFixes(
        identifier: ts.Identifier,
        tsDoc: DocumentSnapshot,
        typeChecker: ts.TypeChecker,
        quote: string,
        formatCodeBasis: FormatCodeBasis
    ): ts.CodeFixAction[] {
        const results: ts.CodeFixAction[] = [];

        const type = identifier && typeChecker.getContextualType(identifier);

        // if it's not union typescript should be able to do it. no need to enhance
        if (!type || !type.isUnion()) {
            return [];
        }

        const nonNullable = type.getNonNullableType();

        if (
            !(
                nonNullable.flags & ts.TypeFlags.Object &&
                (nonNullable as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous
            )
        ) {
            return [];
        }

        const signature = typeChecker.getSignaturesOfType(nonNullable, ts.SignatureKind.Call)[0];

        const parameters = signature.parameters.map((p) => {
            const declaration = p.valueDeclaration ?? p.declarations?.[0];
            const typeString = declaration
                ? typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(p, declaration))
                : '';

            return { name: p.name, typeString };
        });

        const returnType = typeChecker.typeToString(signature.getReturnType());
        const useJsDoc =
            tsDoc.scriptKind === ts.ScriptKind.JS || tsDoc.scriptKind === ts.ScriptKind.JSX;
        const parametersText = (
            useJsDoc
                ? parameters.map((p) => p.name)
                : parameters.map((p) => p.name + (p.typeString ? ': ' + p.typeString : ''))
        ).join(', ');

        const jsDoc = useJsDoc
            ? ['/**', ...parameters.map((p) => ` * @param {${p.typeString}} ${p.name}`), ' */']
            : [];

        const newText = [
            ...jsDoc,
            `function ${identifier.text}(${parametersText})${useJsDoc ? '' : ': ' + returnType} {`,
            formatCodeBasis.indent +
                `throw new Error(${quote}Function not implemented.${quote})` +
                formatCodeBasis.semi,
            '}'
        ]
            .map((line) => formatCodeBasis.baseIndent + line + formatCodeBasis.newLine)
            .join('');

        results.push({
            description: `Add missing function declaration '${identifier.text}'`,
            fixName: 'fixMissingFunctionDeclaration',
            changes: [
                {
                    fileName: tsDoc.filePath,
                    textChanges: [
                        {
                            newText,
                            span: { start: 0, length: 0 }
                        }
                    ]
                }
            ]
        });

        return results;
    }

    private isQuickFixForEventHandler(document: Document, diagnostic: Diagnostic) {
        const htmlNode = document.html.findNodeAt(document.offsetAt(diagnostic.range.start));
        if (
            !htmlNode.attributes ||
            !Object.keys(htmlNode.attributes).some((attr) => attr.startsWith('on:'))
        ) {
            return false;
        }

        return true;
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
        const scriptInfo = document.moduleScriptInfo ?? document.scriptInfo;
        if (!scriptInfo) {
            return undefined;
        }

        const newText = ts.sys.newLine + edit.newText;

        return TextEdit.insert(scriptInfo.startPos, newText);
    }

    private checkDisableJsDiagnosticsCodeInsert(
        originalRange: Range,
        document: Document,
        edit: ts.TextChange
    ): TextEdit | null {
        const inModuleScript = isInTag(originalRange.start, document.moduleScriptInfo);
        if (!isInTag(originalRange.start, document.scriptInfo) && !inModuleScript) {
            return null;
        }

        const position = inModuleScript
            ? originalRange.start
            : this.fixPropsCodeActionRange(originalRange.start, document) ?? originalRange.start;

        // fix the length of trailing indent
        const linesOfNewText = edit.newText.split('\n');
        if (/^[ \t]*$/.test(linesOfNewText[linesOfNewText.length - 1])) {
            const line = getLineAtPosition(originalRange.start, document.getText());
            const indent = getIndent(line);
            linesOfNewText[linesOfNewText.length - 1] = indent;
        }

        return TextEdit.insert(position, linesOfNewText.join('\n'));
    }

    /**
     * svelte2tsx removes export in instance script
     */
    private fixPropsCodeActionRange(start: Position, document: Document): Position | undefined {
        const documentText = document.getText();
        const offset = document.offsetAt(start);
        const exportKeywordOffset = documentText.lastIndexOf('export', offset);

        // export                 let a;
        if (
            exportKeywordOffset < 0 ||
            documentText.slice(exportKeywordOffset + 'export'.length, offset).trim()
        ) {
            return;
        }

        const charBeforeExport = documentText[exportKeywordOffset - 1];
        if (
            (charBeforeExport !== undefined && !charBeforeExport.trim()) ||
            charBeforeExport === ';'
        ) {
            return document.positionAt(exportKeywordOffset);
        }
    }

    private checkAddJsDocCodeActionRange(
        snapshot: DocumentSnapshot,
        originalRange: Range,
        document: Document
    ): Range {
        if (
            snapshot.scriptKind !== ts.ScriptKind.JS &&
            snapshot.scriptKind !== ts.ScriptKind.JSX &&
            !isInTag(originalRange.start, document.scriptInfo)
        ) {
            return originalRange;
        }

        const position = this.fixPropsCodeActionRange(originalRange.start, document);

        if (position) {
            return {
                start: position,
                end: position
            };
        }

        return originalRange;
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
