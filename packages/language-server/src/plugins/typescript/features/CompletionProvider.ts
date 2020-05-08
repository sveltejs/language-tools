import ts from 'typescript';
import { Position, TextDocumentIdentifier, TextEdit, CompletionList } from 'vscode-languageserver';
import { CompletionsProvider, AppCompletionList, AppCompletionItem } from '../../interfaces';
import {
    Document,
    mapCompletionItemToParent,
    mapRangeToParent,
    extractTag,
} from '../../../lib/documents';
import { LSAndTSDocResovler } from '../LSAndTSDocResovler';
import {
    scriptElementKindToCompletionItemKind,
    getCommitCharactersForScriptElement,
    convertRange,
} from '../utils';
import { pathToUrl } from '../../../utils';
import { SnapshotFragment } from '../DocumentSnapshot';

export interface CompletionEntryWithIdentifer extends ts.CompletionEntry, TextDocumentIdentifier {
    position: Position;
}

type validTriggerCharacter = '.' | '"' | "'" | '`' | '/' | '@' | '<' | '#';

export class CompletionsProviderImpl implements CompletionsProvider<CompletionEntryWithIdentifer> {
    constructor(private readonly lsAndTsDocResovler: LSAndTSDocResovler) {}

    /**
     * The language service throws an error if the character is not a valid trigger character.
     * Also, the completions are worse.
     * Therefore, only use the characters the typescript compiler treats as valid.
     */
    private readonly validTriggerCharacters = ['.', '"', "'", '`', '/', '@', '<', '#'] as const;

    private isValidTriggerCharacter(
        character: string | undefined,
    ): character is validTriggerCharacter {
        return this.validTriggerCharacters.includes(character as validTriggerCharacter);
    }

    async getCompletions(
        document: Document,
        position: Position,
        triggerCharacter?: string | undefined,
    ): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
        const { lang, tsDoc } = this.lsAndTsDocResovler.getLSAndTSDoc(document);

        // ------------------------------
        //     const { lang, tsDoc } = this.getLSAndTSDoc(document);
        //     const fragment = await tsDoc.getFragment();
        //     // The language service throws an error if the character is not a valid trigger character.
        //     // Also, the completions are worse.
        //     // Therefore, only use the characters the typescript compiler treats as valid.
        //     const validTriggerCharacter = ['.', '"', "'", '`', '/', '@', '<', '#'].includes(
        //         triggerCharacter!,
        //     )
        //         ? triggerCharacter
        //         : undefined;
        //     const completions = lang.getCompletionsAtPosition(
        //         tsDoc.filePath,
        //         fragment.offsetAt(fragment.positionInFragment(position)),
        //         {
        //             includeCompletionsForModuleExports: true,
        //             triggerCharacter: validTriggerCharacter as any,
        //         },
        //     );
        // }

        //     if (!completions) {
        //         return null;
        //     }

        //     return CompletionList.create(
        //         completions!.entries
        //             .map(comp => {
        //                 return <CompletionItem>{
        //                     label: comp.name,
        //                     kind: scriptElementKindToCompletionItemKind(comp.kind),
        //                     sortText: comp.sortText,
        //                     commitCharacters: getCommitCharactersForScriptElement(comp.kind),
        //                     preselect: comp.isRecommended,
        //                 };
        //             })
        //             .map(comp => mapCompletionItemToParent(fragment, comp)),
        //     );
        // ------------------------------

        const filePath = tsDoc.filePath;

        if (!filePath) {
            return null;
        }

        const fragment = await tsDoc.getFragment();
        const validTriggerCharacter = this.isValidTriggerCharacter(triggerCharacter)
            ? triggerCharacter
            : undefined;

        const completions = lang.getCompletionsAtPosition(
            filePath,
            fragment.offsetAt(fragment.positionInFragment(position)),
            {
                includeCompletionsForModuleExports: true,
                triggerCharacter: validTriggerCharacter,
            },
        );

        if (!completions) {
            return null;
        }

        const completionItems = completions.entries
            .map((comp) => this.toCompletionItem(comp, pathToUrl(tsDoc.filePath), position))
            .map((comp) => mapCompletionItemToParent(fragment, comp));

        return CompletionList.create(completionItems);
    }

    private toCompletionItem(
        comp: ts.CompletionEntry,
        uri: string,
        position: Position,
    ): AppCompletionItem<CompletionEntryWithIdentifer> {
        const { label, insertText } = this.getCompletionLableAndInsert(comp);

        return {
            label,
            insertText,
            kind: scriptElementKindToCompletionItemKind(comp.kind),
            sortText: comp.sortText,
            commitCharacters: getCommitCharactersForScriptElement(comp.kind),
            preselect: comp.isRecommended,
            // pass essential data for resolving completion
            data: {
                ...comp,
                uri,
                position,
            },
        };
    }

    private getCompletionLableAndInsert(comp: ts.CompletionEntry) {
        const { kind, kindModifiers, name } = comp;
        const isScriptElement = kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);

        if (isScriptElement && hasModifier) {
            return {
                insertText: name,
                label: name + kindModifiers,
            };
        }
        return {
            label: name,
        };
    }

    async resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>,
    ): Promise<AppCompletionItem<CompletionEntryWithIdentifer>> {
        const { data: comp } = completionItem;
        const { tsDoc, lang } = this.lsAndTsDocResovler.getLSAndTSDoc(document);

        const filePath = tsDoc.filePath;

        if (!comp || !filePath) {
            return completionItem;
        }

        const fragment = await tsDoc.getFragment();
        const detail = lang.getCompletionEntryDetails(
            filePath,
            fragment.offsetAt(fragment.positionInFragment(comp.position)),
            comp.name,
            {},
            comp.source,
            {},
        );

        if (detail) {
            const {
                detail: itemDetail,
                documentation: itemDocumentation,
            } = this.getCompletionDocument(detail);

            completionItem.detail = itemDetail;
            completionItem.documentation = itemDocumentation;
        }

        const actions = detail?.codeActions;
        if (actions) {
            const edit: TextEdit[] = [];

            for (const action of actions) {
                for (const change of action.changes) {
                    edit.push(...this.codeActionChangesToTextEdit(document, fragment, change));
                }
            }

            completionItem.additionalTextEdits = edit;
        }

        return completionItem;
    }

    private getCompletionDocument(compDetail: ts.CompletionEntryDetails) {
        const { source, documentation: tsDocumentation, displayParts } = compDetail;
        let detail: string = ts.displayPartsToString(displayParts);

        if (source) {
            const importPath = ts.displayPartsToString(source);
            detail = `Auto import from ${importPath}\n${detail}`;
        }

        const documentation = tsDocumentation
            ? ts.displayPartsToString(tsDocumentation)
            : undefined;

        return {
            documentation,
            detail,
        };
    }

    private codeActionChangesToTextEdit(
        doc: Document,
        fragment: SnapshotFragment,
        changes: ts.FileTextChanges,
    ): TextEdit[] {
        return changes.textChanges.map((change) =>
            this.codeActionChangeToTextEdit(doc, fragment, change),
        );
    }

    private codeActionChangeToTextEdit(
        doc: Document,
        fragment: SnapshotFragment,
        change: ts.TextChange,
    ): TextEdit {
        const { span } = change;
        // prevent newText from being placed like this: <script>import {} from ''
        if (span.start === 0) {
            change.newText = ts.sys.newLine + change.newText;
        }
        let range = mapRangeToParent(fragment, convertRange(fragment, span));
        // Special case handling to get around wrong mapping of imports.
        if (range.start.line === 0 && range.start.character === 1 && span.length === 0) {
            span.start = span.start - 1 || 0;
            range = mapRangeToParent(fragment, convertRange(fragment, span));
            range.start.line += 1;
            range.start.character = 0;
            range.end = range.start;
        }
        // If range is somehow not mapped in parent, use script starting point instead.
        // This happens if the completion is the first import of the file.
        if (range.start.line === -1) {
            range = convertRange(doc, {
                start: extractTag(doc.getText(), 'script')?.start || 0 + span.start,
                length: span.length,
            });
        }

        return TextEdit.replace(range, change.newText);
    }
}
