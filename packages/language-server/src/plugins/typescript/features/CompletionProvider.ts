import ts from 'typescript';
import { Position, TextDocumentIdentifier, TextEdit, CompletionList, CompletionContext, CompletionTriggerKind } from 'vscode-languageserver';
import {
    CompletionsProvider,
    AppCompletionList,
    AppCompletionItem,
    Resolvable
} from '../../interfaces';
import { Document, mapCompletionItemToParent, mapRangeToParent } from '../../../lib/documents';
import { LSAndTSDocResovler } from "../LSAndTSDocResovler";
import {
    scriptElementKindToCompletionItemKind,
    getCommitCharactersForScriptElement,
    convertRange
} from '../utils';
import { TypescriptDocument } from '../TypescriptDocument';

export interface CompletionEntryWithIdentifer extends
    ts.CompletionEntry, TextDocumentIdentifier {
    position: Position;
}

type validTriggerCharacter = '.' | '"'| "'" | '`' | '/' | '@' | '<' | '#'

export class CompletionsProviderImpl
    implements CompletionsProvider<CompletionEntryWithIdentifer> {
    constructor(
        private readonly lsAndTsDocResovler: LSAndTSDocResovler
    ) { }

    /**
     * The language service throws an error if the character is not a valid trigger character.
     * Also, the completions are worse.
     * Therefore, only use the characters the typescript compiler treats as valid.
     */
    private readonly validTriggerCharacters =
        ['.', '"', "'", '`', '/', '@', '<', '#'] as const;

    private isValidTriggerCharacter(character: string | undefined):
        character is validTriggerCharacter {
        return this.validTriggerCharacters.includes(character as validTriggerCharacter);
    }

    getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): AppCompletionList<CompletionEntryWithIdentifer> | null {
        const { lang, tsDoc } = this.lsAndTsDocResovler.getLSAndTSDoc(document);

        const filePath = tsDoc.getFilePath();

        if (!filePath) {
            return null;
        }
        const triggerCharacter = completionContext?.triggerCharacter;
        const triggerKind = completionContext?.triggerKind;

        const validTriggerCharacter =
            this.isValidTriggerCharacter(triggerCharacter) ? triggerCharacter :
            undefined;
        const isCustomTriggerCharacter =
            triggerKind === CompletionTriggerKind.TriggerCharacter;

        // ignore any custom trigger character specified in server capabilities
        //  and is not allow by ts
        if (isCustomTriggerCharacter && !validTriggerCharacter) {
            return null;
        }

        const completions = lang.getCompletionsAtPosition(
            filePath,
            tsDoc.offsetAt(tsDoc.positionInFragment(position)),
            {
                includeCompletionsForModuleExports: true,
                triggerCharacter: validTriggerCharacter,
            },
        );

        if (!completions) {
            return null;
        }

        const completionItems = completions.entries
            .map(comp => this.toCompletionItem(comp, tsDoc.uri, position))
            .map(comp => mapCompletionItemToParent(tsDoc, comp));

        return CompletionList.create(completionItems);
    }

    private toCompletionItem(
        comp: ts.CompletionEntry,
        uri: string,
        position: Position
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
                position
            }
        };
    }

    private getCompletionLableAndInsert(comp: ts.CompletionEntry) {
        const { kind, kindModifiers, name } = comp;
        const isScriptElement = kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);

        if (isScriptElement && hasModifier) {
            return {
                insertText: name,
                label: name + kindModifiers
            };
        }
        return {
            label: name
        };
    }

    resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>):
        Resolvable<AppCompletionItem<CompletionEntryWithIdentifer>> {
        const { data: comp } = completionItem;
        const { tsDoc, lang } = this.lsAndTsDocResovler.getLSAndTSDoc(document);

        const filePath = tsDoc.getFilePath();

        if (!comp || !filePath) {
            return completionItem;
        }

        const detail = lang.getCompletionEntryDetails(
            filePath,
            tsDoc.offsetAt(tsDoc.positionInFragment(comp.position)),
            comp.name,
            {},
            comp.source,
            {}
        );

        if (detail) {
            const {
                detail: itemDetail,
                documentation: itemDocumentation
            } = this.getCompletionDocument(detail);

            completionItem.detail = itemDetail;
            completionItem.documentation = itemDocumentation;
        }

        const actions = detail?.codeActions;
        if (actions) {
            const edit: TextEdit[] = [];

            for (const action of actions) {
                for (const change of action.changes) {
                    edit.push(...this.codeActionChangesToTextEdit(tsDoc, change));
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

        const documentation = tsDocumentation ?
            ts.displayPartsToString(tsDocumentation) :
            undefined;

        return {
            documentation,
            detail
        };
    }

    private codeActionChangesToTextEdit(
        tsDoc: TypescriptDocument,
        changes: ts.FileTextChanges
    ): TextEdit[] {
        return changes.textChanges.map(change =>
            this.codeActionChangeToTextEdit(tsDoc, change)
        );
    }

    private codeActionChangeToTextEdit(
        tsDoc: TypescriptDocument,
        change: ts.TextChange
    ): TextEdit {
        const { span } = change;
        // stop newText be placed like this: <script>import {} from ''
        if (span.start === 0) {
            change.newText = ts.sys.newLine + change.newText;
        }
        const range = mapRangeToParent(
            tsDoc,
            convertRange(tsDoc, span)
        );

        return TextEdit.replace(range, change.newText);
    }
}
