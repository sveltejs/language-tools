import ts from 'typescript';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Diagnostic,
    LSPAny,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    TextDocumentEdit,
    TextDocumentIdentifier,
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
    memoize,
    modifyLines,
    normalizePath,
    pathToUrl,
    possiblyComponent,
    removeLineWithString
} from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    changeSvelteComponentName,
    convertRange,
    isInScript,
    toGeneratedSvelteComponentName
} from '../utils';
import { CompletionsProviderImpl } from './CompletionProvider';
import {
    findClosestContainingNode,
    FormatCodeBasis,
    getFormatCodeBasis,
    getNewScriptStartTag,
    getQuotePreference,
    isTextSpanInGeneratedCode,
    SnapshotMap
} from './utils';
import { DiagnosticCode } from './DiagnosticsProvider';
import { createGetCanonicalFileName } from '../../../utils';
import { LanguageServiceContainer } from '../service';

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

interface CustomFixCannotFindNameInfo extends ts.CodeFixAction {
    position: Position;
}

interface QuickFixConversionOptions {
    fix: ts.CodeFixAction | CustomFixCannotFindNameInfo;
    snapshots: SnapshotMap;
    document: Document;
    formatCodeSettings: ts.FormatCodeSettings;
    formatCodeBasis: FormatCodeBasis;
    getDiagnostics: () => Diagnostic[];
    skipAddScriptTag?: boolean;
}

type FixId = NonNullable<ts.CodeFixAction['fixId']>;

interface QuickFixAllResolveInfo extends TextDocumentIdentifier {
    fixId: FixId;
    fixName: string;
}

const FIX_IMPORT_FIX_NAME = 'import';
const FIX_IMPORT_FIX_ID = 'fixMissingImport';
const FIX_IMPORT_FIX_DESCRIPTION = 'Add all missing imports';
const nonIdentifierRegex = /[\`\~\!\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>/\?\s]/;

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

    async resolveCodeAction(
        document: Document,
        codeAction: CodeAction,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CodeAction> {
        if (!this.isQuickFixAllResolveInfo(codeAction.data)) {
            return codeAction;
        }

        const { lang, tsDoc, userPreferences, lsContainer } =
            await this.lsAndTsDocResolver.getLSAndTSDoc(document);
        if (cancellationToken?.isCancellationRequested) {
            return codeAction;
        }

        const formatCodeSettings = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );
        const formatCodeBasis = getFormatCodeBasis(formatCodeSettings);

        const getDiagnostics = memoize(() =>
            lang.getSemanticDiagnostics(tsDoc.filePath).map(
                (dia): Diagnostic => ({
                    range: mapRangeToOriginal(tsDoc, convertRange(tsDoc, dia)),
                    message: '',
                    code: dia.code
                })
            )
        );

        const isImportFix = codeAction.data.fixName === FIX_IMPORT_FIX_NAME;
        const virtualDocInfo = isImportFix
            ? this.createVirtualDocumentForCombinedImportCodeFix(
                  document,
                  getDiagnostics(),
                  tsDoc,
                  lsContainer,
                  lang
              )
            : undefined;

        const fix = lang.getCombinedCodeFix(
            {
                type: 'file',
                fileName: (virtualDocInfo?.virtualDoc ?? document).getFilePath()!
            },
            codeAction.data.fixId,
            formatCodeSettings,
            userPreferences
        );

        if (virtualDocInfo) {
            const getCanonicalFileName = createGetCanonicalFileName(
                ts.sys.useCaseSensitiveFileNames
            );

            const virtualDocPath = getCanonicalFileName(
                normalizePath(virtualDocInfo.virtualDoc.getFilePath()!)
            );

            for (const change of fix.changes) {
                if (getCanonicalFileName(normalizePath(change.fileName)) === virtualDocPath) {
                    change.fileName = tsDoc.filePath;

                    this.removeDuplicatedComponentImport(virtualDocInfo.insertedNames, change);
                }
            }

            await this.lsAndTsDocResolver.deleteSnapshot(virtualDocPath);
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        const fixActions: ts.CodeFixAction[] = [
            {
                fixName: codeAction.data.fixName,
                changes: Array.from(fix.changes),
                description: ''
            }
        ];

        const documentChangesPromises = fixActions.map((fix) =>
            this.convertAndFixCodeFixAction({
                document,
                fix,
                formatCodeBasis,
                formatCodeSettings,
                getDiagnostics,
                snapshots,
                skipAddScriptTag: true
            })
        );
        const documentChanges = (await Promise.all(documentChangesPromises)).flat();

        if (cancellationToken?.isCancellationRequested) {
            return codeAction;
        }

        if (isImportFix) {
            this.fixCombinedImportQuickFix(documentChanges, document, formatCodeBasis);
        }

        codeAction.edit = {
            documentChanges
        };

        return codeAction;
    }

    /**
     * Do not use this in regular code action
     * This'll cause TypeScript to rebuild and invalidate caches every time. It'll be slow
     */
    private createVirtualDocumentForCombinedImportCodeFix(
        document: Document,
        diagnostics: Diagnostic[],
        tsDoc: DocumentSnapshot,
        lsContainer: LanguageServiceContainer,
        lang: ts.LanguageService
    ) {
        const virtualUri = document.uri + '.__virtual__.svelte';
        const names = new Set<string>();
        const sourceFile = lang.getProgram()?.getSourceFile(tsDoc.filePath);
        if (!sourceFile) {
            return undefined;
        }

        for (const diagnostic of diagnostics) {
            if (
                diagnostic.range.start.line < 0 ||
                diagnostic.range.end.line < 0 ||
                (diagnostic.code !== DiagnosticCode.CANNOT_FIND_NAME &&
                    diagnostic.code !== DiagnosticCode.CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y)
            ) {
                continue;
            }
            const identifier = this.findIdentifierForDiagnostic(tsDoc, diagnostic, sourceFile);
            const name = identifier?.text;
            if (!name || names.has(name)) {
                continue;
            }

            if (name.startsWith('$')) {
                names.add(name.slice(1));
            } else if (!isInScript(diagnostic.range.start, document)) {
                if (this.isComponentStartTag(identifier)) {
                    names.add(toGeneratedSvelteComponentName(name));
                }
            }
        }

        if (!names.size) {
            return undefined;
        }

        const inserts = Array.from(names.values())
            .map((name) => name + ';')
            .join('');

        // assumption: imports are always at the top of the script tag
        // so these appends won't change the position of the edits
        const text = document.getText();
        const newText = document.scriptInfo
            ? text.slice(0, document.scriptInfo.end) + inserts + text.slice(document.scriptInfo.end)
            : `${document.getText()}<script>${inserts}</script>`;

        const virtualDoc = new Document(virtualUri, newText);
        virtualDoc.openedByClient = true;
        // let typescript know about the virtual document
        lsContainer.openVirtualDocument(virtualDoc);
        lsContainer.getService();

        return {
            virtualDoc,
            insertedNames: names
        };
    }

    /**
     * Remove component default import if there is a named import with the same name
     * Usually happens with reexport or inheritance of component library
     */
    private removeDuplicatedComponentImport(
        insertedNames: Set<string>,
        change: ts.FileTextChanges
    ) {
        for (const name of insertedNames) {
            const unSuffixedNames = changeSvelteComponentName(name);
            const matchRegex = unSuffixedNames != name && this.toImportMemberRegex(unSuffixedNames);
            if (
                !matchRegex ||
                !change.textChanges.some((textChange) => textChange.newText.match(matchRegex))
            ) {
                continue;
            }

            const importRegex = new RegExp(`\\s+import ${name} from ('|")(.*)('|");?\r?\n?`);
            change.textChanges = change.textChanges
                .map((textChange) => ({
                    ...textChange,
                    newText: textChange.newText.replace(importRegex, (match) => {
                        if (match.split('\n').length > 2) {
                            return '\n';
                        } else {
                            return '';
                        }
                    })
                }))
                // in case there are replacements
                .filter((change) => change.span.length || change.newText);
        }
    }

    private fixCombinedImportQuickFix(
        documentChanges: TextDocumentEdit[],
        document: Document,
        formatCodeBasis: FormatCodeBasis
    ) {
        if (!documentChanges.length || document.scriptInfo || document.moduleScriptInfo) {
            return;
        }

        const editForThisFile = documentChanges.find(
            (change) => change.textDocument.uri === document.uri
        );

        if (editForThisFile?.edits.length) {
            const [first] = editForThisFile.edits;
            first.newText =
                getNewScriptStartTag(this.configManager.getConfig()) +
                formatCodeBasis.baseIndent +
                first.newText.trimStart();

            const last = editForThisFile.edits[editForThisFile.edits.length - 1];
            last.newText = last.newText + '</script>' + formatCodeBasis.newLine;
        }
    }

    private toImportMemberRegex(name: string) {
        return new RegExp(`${name}($| |,)`);
    }

    private isQuickFixAllResolveInfo(data: LSPAny): data is QuickFixAllResolveInfo {
        const asserted = data as QuickFixAllResolveInfo | undefined;
        return asserted?.fixId != undefined && typeof asserted.fixName === 'string';
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
                    change.textChanges
                        .map((edit) => {
                            const range = this.checkRemoveImportCodeActionRange(
                                edit,
                                tsDoc,
                                mapRangeToOriginal(tsDoc, convertRange(tsDoc, edit.span))
                            );

                            edit.newText = removeLineWithString(
                                edit.newText,
                                'SvelteComponentTyped as __SvelteComponentTyped__'
                            );

                            return this.fixIndentationOfImports(
                                TextEdit.replace(range, edit.newText),
                                document
                            );
                        })
                        .filter(
                            (edit) =>
                                // The __SvelteComponentTyped__ import is added by us and will have a negative mapped line
                                edit.range.start.line !== -1
                        )
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
        const { lang, tsDoc, userPreferences, lsContainer } = await this.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        const start = tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.start));
        const end = tsDoc.offsetAt(tsDoc.getGeneratedPosition(range.end));
        const errorCodes: number[] = context.diagnostics.map((diag) => Number(diag.code));
        const cannotFindNameDiagnostic = context.diagnostics.filter(
            (diagnostic) =>
                diagnostic.code === DiagnosticCode.CANNOT_FIND_NAME ||
                diagnostic.code === DiagnosticCode.CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y
        );

        const formatCodeSettings = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );
        const formatCodeBasis = getFormatCodeBasis(formatCodeSettings);

        let codeFixes: Array<CustomFixCannotFindNameInfo | ts.CodeFixAction> | undefined =
            cannotFindNameDiagnostic.length
                ? this.getComponentImportQuickFix(
                      document,
                      lang,
                      tsDoc,
                      userPreferences,
                      cannotFindNameDiagnostic,
                      formatCodeSettings
                  )
                : undefined;

        // either-or situation when it's not a "did you mean" fix
        if (
            codeFixes === undefined ||
            errorCodes.includes(DiagnosticCode.CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y)
        ) {
            codeFixes ??= [];
            codeFixes = codeFixes.concat(
                ...lang.getCodeFixesAtPosition(
                    tsDoc.filePath,
                    start,
                    end,
                    errorCodes,
                    formatCodeSettings,
                    userPreferences
                ),
                ...this.getSvelteQuickFixes(
                    lang,
                    document,
                    cannotFindNameDiagnostic,
                    tsDoc,
                    formatCodeBasis,
                    userPreferences,
                    formatCodeSettings
                )
            );
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const codeActionsPromises = codeFixes.map(async (fix) => {
            const documentChanges = await this.convertAndFixCodeFixAction({
                fix,
                snapshots,
                document,
                formatCodeSettings,
                formatCodeBasis,
                getDiagnostics: () => context.diagnostics
            });

            const codeAction = CodeAction.create(
                fix.description,
                {
                    documentChanges
                },
                CodeActionKind.QuickFix
            );

            return {
                fix,
                codeAction
            };
        });

        const identifier: TextDocumentIdentifier = {
            uri: document.uri
        };

        const codeActions = await Promise.all(codeActionsPromises);
        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        const codeActionsNotFilteredOut = codeActions.filter(({ codeAction }) =>
            codeAction.edit?.documentChanges?.every(
                (change) => (<TextDocumentEdit>change).edits.length > 0
            )
        );

        const fixAllActions = this.getFixAllActions(
            codeActionsNotFilteredOut.map(({ fix }) => fix),
            identifier,
            tsDoc.filePath,
            lang
        );

        // filter out empty code action
        return codeActionsNotFilteredOut.map(({ codeAction }) => codeAction).concat(fixAllActions);
    }

    private async convertAndFixCodeFixAction({
        fix,
        snapshots,
        document,
        formatCodeSettings,
        formatCodeBasis,
        getDiagnostics,
        skipAddScriptTag
    }: QuickFixConversionOptions) {
        const documentChangesPromises = fix.changes.map(async (change) => {
            const snapshot = await snapshots.retrieve(change.fileName);
            return TextDocumentEdit.create(
                OptionalVersionedTextDocumentIdentifier.create(pathToUrl(change.fileName), null),
                change.textChanges
                    .map((edit) => {
                        if (
                            fix.fixName === FIX_IMPORT_FIX_NAME &&
                            snapshot instanceof SvelteDocumentSnapshot
                        ) {
                            const namePosition = 'position' in fix ? fix.position : undefined;
                            const startPos =
                                namePosition ??
                                this.findDiagnosticForImportFix(document, edit, getDiagnostics())
                                    ?.range?.start ??
                                Position.create(0, 0);

                            return this.completionProvider.codeActionChangeToTextEdit(
                                document,
                                snapshot,
                                edit,
                                true,
                                startPos,
                                formatCodeBasis.newLine,
                                undefined,
                                skipAddScriptTag
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
                            const position = 'position' in fix ? fix.position : undefined;
                            const checkRange = position
                                ? Range.create(position, position)
                                : this.findDiagnosticForQuickFix(
                                      document,
                                      DiagnosticCode.CANNOT_FIND_NAME,
                                      getDiagnostics(),
                                      (possiblyIdentifier) => {
                                          return edit.newText.includes(
                                              'function ' + possiblyIdentifier + '('
                                          );
                                      }
                                  )?.range;

                            originalRange = this.checkEndOfFileCodeInsert(
                                originalRange,
                                checkRange,
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

                        if (fix.fixName === 'fixConvertConstToLet') {
                            const offset = document.offsetAt(originalRange.start);
                            const constOffset = document.getText().indexOf('const', offset);
                            if (constOffset < 0) {
                                return undefined;
                            }
                            const beforeConst = document.getText().slice(0, constOffset);
                            if (
                                beforeConst[beforeConst.length - 1] === '@' &&
                                beforeConst
                                    .slice(0, beforeConst.length - 1)
                                    .trimEnd()
                                    .endsWith('{')
                            ) {
                                return undefined;
                            }
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
        return documentChanges;
    }

    private findDiagnosticForImportFix(
        document: Document,
        edit: ts.TextChange,
        diagnostics: Diagnostic[]
    ) {
        return this.findDiagnosticForQuickFix(
            document,
            DiagnosticCode.CANNOT_FIND_NAME,
            diagnostics,
            (possibleIdentifier) =>
                !nonIdentifierRegex.test(possibleIdentifier) &&
                this.toImportMemberRegex(possibleIdentifier).test(edit.newText)
        );
    }

    private findDiagnosticForQuickFix(
        document: Document,
        targetCode: number,
        diagnostics: Diagnostic[],
        match: (identifier: string) => boolean
    ) {
        const diagnostic = diagnostics.find((diagnostic) => {
            if (diagnostic.code !== targetCode) {
                return false;
            }

            const possibleIdentifier = document.getText(diagnostic.range);
            if (possibleIdentifier) {
                return match(possibleIdentifier);
            }

            return false;
        });

        return diagnostic;
    }

    private getFixAllActions(
        codeFixes: readonly ts.CodeFixAction[],
        identifier: TextDocumentIdentifier,
        fileName: string,
        lang: ts.LanguageService
    ) {
        const checkedFixIds = new Set<FixId>();
        const fixAll: CodeAction[] = [];

        for (const codeFix of codeFixes) {
            if (!codeFix.fixId || !codeFix.fixAllDescription || checkedFixIds.has(codeFix.fixId)) {
                continue;
            }

            // we have custom fix for import
            // check it again if fix-all might be necessary
            if (codeFix.fixName === FIX_IMPORT_FIX_NAME) {
                const allCannotFindNameDiagnostics = lang
                    .getSemanticDiagnostics(fileName)
                    .filter(
                        (diagnostic) =>
                            diagnostic.code === DiagnosticCode.CANNOT_FIND_NAME ||
                            diagnostic.code === DiagnosticCode.CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y
                    );

                if (allCannotFindNameDiagnostics.length < 2) {
                    checkedFixIds.add(codeFix.fixId);
                    continue;
                }
            }

            const codeAction = CodeAction.create(
                codeFix.fixAllDescription,
                CodeActionKind.QuickFix
            );

            const data: QuickFixAllResolveInfo = {
                ...identifier,
                fixName: codeFix.fixName,
                fixId: codeFix.fixId
            };

            codeAction.data = data;
            checkedFixIds.add(codeFix.fixId);
            fixAll.push(codeAction);
        }

        return fixAll;
    }

    /**
     * import quick fix requires the symbol name to be the same as where it's defined.
     * But we have suffix on component default export to prevent conflict with
     * a local variable. So we use auto-import completion as a workaround here.
     */
    private getComponentImportQuickFix(
        document: Document,
        lang: ts.LanguageService,
        tsDoc: DocumentSnapshot,
        userPreferences: ts.UserPreferences,
        diagnostics: Diagnostic[],
        formatCodeSetting: ts.FormatCodeSettings
    ): CustomFixCannotFindNameInfo[] | undefined {
        const sourceFile = lang.getProgram()?.getSourceFile(tsDoc.filePath);

        if (!sourceFile) {
            return;
        }

        const nameToPosition = new Map<string, number>();

        for (const diagnostic of diagnostics) {
            if (isInScript(diagnostic.range.start, document)) {
                continue;
            }
            const possibleIdentifier = document.getText(diagnostic.range);
            if (
                !possibleIdentifier ||
                !possiblyComponent(possibleIdentifier) ||
                nameToPosition.has(possibleIdentifier)
            ) {
                continue;
            }

            const node = this.findIdentifierForDiagnostic(tsDoc, diagnostic, sourceFile);
            if (!node || !this.isComponentStartTag(node)) {
                return;
            }

            const tagNameEnd = node.getEnd();
            const name = node.getText();

            if (possiblyComponent(name)) {
                nameToPosition.set(name, tagNameEnd);
            }
        }

        if (!nameToPosition.size) {
            return;
        }

        const result: CustomFixCannotFindNameInfo[] = [];
        for (const [name, position] of nameToPosition) {
            const errorPreventingUserPreferences =
                this.completionProvider.fixUserPreferencesForSvelteComponentImport(userPreferences);

            const resolvedCompletion = (c: ts.CompletionEntry) =>
                lang.getCompletionEntryDetails(
                    tsDoc.filePath,
                    position,
                    c.name,
                    formatCodeSetting,
                    c.source,
                    errorPreventingUserPreferences,
                    c.data
                );

            const toFix = (c: ts.CompletionEntryDetails) =>
                c.codeActions?.map(
                    (a): CustomFixCannotFindNameInfo => ({
                        ...a,
                        description: changeSvelteComponentName(a.description),
                        fixName: FIX_IMPORT_FIX_NAME,
                        fixId: FIX_IMPORT_FIX_ID,
                        fixAllDescription: FIX_IMPORT_FIX_DESCRIPTION,
                        position: originalPosition
                    })
                ) ?? [];

            const completion = lang.getCompletionsAtPosition(
                tsDoc.filePath,
                position,
                userPreferences,
                formatCodeSetting
            );

            const entries = completion?.entries
                .filter((c) => c.name === name || c.name === toGeneratedSvelteComponentName(name))
                .map(resolvedCompletion)
                .sort(
                    (a, b) =>
                        this.numberOfDirectorySeparators(
                            ts.displayPartsToString(a?.sourceDisplay ?? [])
                        ) -
                        this.numberOfDirectorySeparators(
                            ts.displayPartsToString(b?.sourceDisplay ?? [])
                        )
                )
                .filter(isNotNullOrUndefined);

            if (!entries?.length) {
                continue;
            }

            const originalPosition = tsDoc.getOriginalPosition(tsDoc.positionAt(position));
            const resultForName = entries.flatMap(toFix);

            result.push(...resultForName);
        }

        return result;
    }

    private isComponentStartTag(node: ts.Identifier) {
        return (
            ts.isCallExpression(node.parent) &&
            ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === '__sveltets_2_ensureComponent' &&
            ts.isIdentifier(node)
        );
    }

    private numberOfDirectorySeparators(path: string) {
        return path.split('/').length - 1;
    }

    private getSvelteQuickFixes(
        lang: ts.LanguageService,
        document: Document,
        cannotFindNameDiagnostics: Diagnostic[],
        tsDoc: DocumentSnapshot,
        formatCodeBasis: FormatCodeBasis,
        userPreferences: ts.UserPreferences,
        formatCodeSettings: ts.FormatCodeSettings
    ): CustomFixCannotFindNameInfo[] {
        const program = lang.getProgram();
        const sourceFile = program?.getSourceFile(tsDoc.filePath);
        if (!program || !sourceFile) {
            return [];
        }

        const typeChecker = program.getTypeChecker();
        const results: CustomFixCannotFindNameInfo[] = [];
        const quote = getQuotePreference(sourceFile, userPreferences);
        const getGlobalCompletion = memoize(() =>
            lang.getCompletionsAtPosition(tsDoc.filePath, 0, userPreferences, formatCodeSettings)
        );
        const [tsMajorStr] = ts.version.split('.');
        const tsSupportHandlerQuickFix = parseInt(tsMajorStr) >= 5;

        for (const diagnostic of cannotFindNameDiagnostics) {
            const identifier = this.findIdentifierForDiagnostic(tsDoc, diagnostic, sourceFile);

            if (!identifier) {
                continue;
            }

            const isQuickFixTargetTargetStore = identifier?.escapedText.toString().startsWith('$');

            const fixes: ts.CodeFixAction[] = [];
            if (isQuickFixTargetTargetStore) {
                fixes.push(
                    ...this.getSvelteStoreQuickFixes(
                        identifier,
                        lang,
                        tsDoc,
                        userPreferences,
                        formatCodeSettings,
                        getGlobalCompletion
                    )
                );
            }

            if (!tsSupportHandlerQuickFix) {
                const isQuickFixTargetEventHandler = this.isQuickFixForEventHandler(
                    document,
                    diagnostic
                );
                if (isQuickFixTargetEventHandler) {
                    fixes.push(
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

            if (!fixes.length) {
                continue;
            }

            const originalPosition = tsDoc.getOriginalPosition(tsDoc.positionAt(identifier.pos));
            results.push(
                ...fixes.map((fix) => ({
                    name: identifier.getText(),
                    position: originalPosition,
                    ...fix
                }))
            );
        }

        return results;
    }

    private findIdentifierForDiagnostic(
        tsDoc: DocumentSnapshot,
        diagnostic: Diagnostic,
        sourceFile: ts.SourceFile
    ) {
        const start = tsDoc.offsetAt(tsDoc.getGeneratedPosition(diagnostic.range.start));
        const end = tsDoc.offsetAt(tsDoc.getGeneratedPosition(diagnostic.range.end));

        const identifier = findClosestContainingNode(
            sourceFile,
            { start, length: end - start },
            ts.isIdentifier
        );

        return identifier;
    }

    // TODO: Remove this in late 2023
    // when most users have upgraded to TS 5.0+
    private getSvelteStoreQuickFixes(
        identifier: ts.Identifier,
        lang: ts.LanguageService,
        tsDoc: DocumentSnapshot,
        userPreferences: ts.UserPreferences,
        formatCodeSettings: ts.FormatCodeSettings,
        getCompletions: () => ts.CompletionInfo | undefined
    ): ts.CodeFixAction[] {
        const storeIdentifier = identifier.escapedText.toString().substring(1);
        const completion = getCompletions();

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
                    changes: a.changes.map((change) => {
                        return {
                            ...change,
                            textChanges: change.textChanges.map((textChange) => {
                                // For some reason, TS sometimes adds the `type` modifier. Remove it.
                                return {
                                    ...textChange,
                                    newText: textChange.newText.replace(' type ', ' ')
                                };
                            })
                        };
                    }),
                    fixName: FIX_IMPORT_FIX_NAME,
                    fixId: FIX_IMPORT_FIX_ID,
                    fixAllDescription: FIX_IMPORT_FIX_DESCRIPTION
                })) ?? [];

        return flatten(completion.entries.filter((c) => c.name === storeIdentifier).map(toFix));
    }

    /**
     * Workaround for TypeScript doesn't provide a quick fix if the signature is typed as union type, like `(() => void) | null`
     * We can remove this once TypeScript doesn't have this limitation.
     */
    private getEventHandlerQuickFixes(
        identifier: ts.Identifier,
        tsDoc: DocumentSnapshot,
        typeChecker: ts.TypeChecker,
        quote: string,
        formatCodeBasis: FormatCodeBasis
    ): ts.CodeFixAction[] {
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
            `function ${identifier.text}(${parametersText})${
                useJsDoc || returnType === 'any' ? '' : ': ' + returnType
            } {`,
            formatCodeBasis.indent +
                `throw new Error(${quote}Function not implemented.${quote})` +
                formatCodeBasis.semi,
            '}'
        ]
            .map((line) => formatCodeBasis.baseIndent + line + formatCodeBasis.newLine)
            .join('');

        return [
            {
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
            }
        ];
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
    private checkEndOfFileCodeInsert(
        resultRange: Range,
        targetRange: Range | undefined,
        document: Document
    ) {
        if (resultRange.start.line < 0 || resultRange.end.line < 0) {
            if (
                document.moduleScriptInfo &&
                (!targetRange || isRangeInTag(targetRange, document.moduleScriptInfo))
            ) {
                return Range.create(
                    document.moduleScriptInfo.endPos,
                    document.moduleScriptInfo.endPos
                );
            }

            if (document.scriptInfo) {
                return Range.create(document.scriptInfo.endPos, document.scriptInfo.endPos);
            }
        }

        // don't add script tag here because the code action is calculated
        // when the file is treated as js
        // but user might want a ts version of the code action
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
            : (this.fixPropsCodeActionRange(originalRange.start, document) ?? originalRange.start);

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
