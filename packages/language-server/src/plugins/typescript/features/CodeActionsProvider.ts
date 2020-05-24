import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Range,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { pathToUrl } from '../../../utils';
import { CodeActionsProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';

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

        if (!context.only || context.only.includes(CodeActionKind.QuickFix)) {
            return await this.applyQuickfix(document, range, context);
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

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
