import ts from 'typescript';
import {
    CompletionContext,
    CompletionList,
    CompletionTriggerKind,
    Position,
    Range,
    TextDocumentIdentifier,
    TextEdit,
} from 'vscode-languageserver';
import { Document, mapCompletionItemToParent, mapRangeToParent } from '../../../lib/documents';
import { isNotNullOrUndefined, pathToUrl } from '../../../utils';
import { AppCompletionItem, AppCompletionList, CompletionsProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResovler } from '../LSAndTSDocResovler';
import {
    convertRange,
    getCommitCharactersForScriptElement,
    scriptElementKindToCompletionItemKind,
} from '../utils';

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
        completionContext?: CompletionContext,
    ): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
        const { lang, tsDoc } = this.lsAndTsDocResovler.getLSAndTSDoc(document);

        const filePath = tsDoc.filePath;
        if (!filePath) {
            return null;
        }

        const triggerCharacter = completionContext?.triggerCharacter;
        const triggerKind = completionContext?.triggerKind;

        const validTriggerCharacter = this.isValidTriggerCharacter(triggerCharacter)
            ? triggerCharacter
            : undefined;
        const isCustomTriggerCharacter = triggerKind === CompletionTriggerKind.TriggerCharacter;

        // ignore any custom trigger character specified in server capabilities
        //  and is not allow by ts
        if (isCustomTriggerCharacter && !validTriggerCharacter) {
            return null;
        }

        const fragment = await tsDoc.getFragment();
        if (!fragment.isInFragment(position)) {
            return null;
        }

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
            .map((comp) =>
                this.toCompletionItem(fragment, comp, pathToUrl(tsDoc.filePath), position),
            )
            .filter(isNotNullOrUndefined)
            .map((comp) => mapCompletionItemToParent(fragment, comp));

        return CompletionList.create(completionItems);
    }

    private toCompletionItem(
        fragment: SnapshotFragment,
        comp: ts.CompletionEntry,
        uri: string,
        position: Position,
    ): AppCompletionItem<CompletionEntryWithIdentifer> | null {
        const result = this.getCompletionLabelAndInsert(fragment, comp);
        if (!result) {
            return null;
        }

        const { label, insertText, isSvelteComp } = result;

        return {
            label,
            insertText,
            kind: scriptElementKindToCompletionItemKind(comp.kind),
            commitCharacters: getCommitCharactersForScriptElement(comp.kind),
            // Make sure svelte component takes precedence
            sortText: isSvelteComp ? '-1' : comp.sortText,
            preselect: isSvelteComp ? true : comp.isRecommended,
            // pass essential data for resolving completion
            data: {
                ...comp,
                uri,
                position,
            },
        };
    }

    private getCompletionLabelAndInsert(fragment: SnapshotFragment, comp: ts.CompletionEntry) {
        let { kind, kindModifiers, name, source } = comp;
        const isScriptElement = kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);

        const isSvelteComp = this.isSvelteComponentImport(`import ${name} from ${source}`);
        if (isSvelteComp) {
            name = this.changeSvelteComponentName(name);

            if (this.isExistingSvelteComponentImport(fragment, name, source)) {
                return null;
            }
        }

        if (isScriptElement && hasModifier) {
            return {
                insertText: name,
                label: name + kindModifiers,
                isSvelteComp,
            };
        }
        if (isSvelteComp && kind === ts.ScriptElementKind.classElement) {
            return {
                insertText: name,
                label: name,
                isSvelteComp,
            };
        }
        return {
            label: name,
            isSvelteComp,
        };
    }

    private isExistingSvelteComponentImport(
        fragment: SnapshotFragment,
        name: string,
        source?: string,
    ): boolean {
        const importStatement = new RegExp(`import ${name} from ["'\`][\\s\\S]+\\.svelte["'\`]`);
        return !!source && !!fragment.text.match(importStatement);
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
        if (this.isSvelteComponentImport(change.newText)) {
            change.newText = this.changeSvelteComponentImportName(change.newText);
        }

        const scriptTagInfo = fragment.scriptInfo;
        if (!scriptTagInfo) {
            // no script tag defined yet, add it.
            return TextEdit.replace(
                beginOfDocumentRange,
                `<script>${ts.sys.newLine}${change.newText}</script>${ts.sys.newLine}`,
            );
        }

        const { span } = change;
        // prevent newText from being placed like this: <script>import {} from ''
        if (span.start === 0) {
            change.newText = ts.sys.newLine + change.newText;
        }

        let range = mapRangeToParent(fragment, convertRange(fragment, span));
        // If range is somehow not mapped in parent or the import is mapped wrong,
        // use script starting point instead.
        // This happens among other things if the completion is the first import of the file.
        if (
            range.start.line === -1 ||
            (range.start.line === 0 && range.start.character <= 1 && span.length === 0)
        ) {
            range = convertRange(doc, {
                start: scriptTagInfo.start,
                length: span.length,
            });
        }

        return TextEdit.replace(range, change.newText);
    }

    private isSvelteComponentImport(text: string) {
        return /import \w+ from [\s\S]*.svelte($|"|'| )/.test(text);
    }

    private changeSvelteComponentImportName(text: string) {
        return text.replace(
            /import (\w+) from /,
            (_, componentMatch) => `import ${this.changeSvelteComponentName(componentMatch)} from `,
        );
    }

    private changeSvelteComponentName(name: string) {
        const newName = name.replace(/(\w+)Svelte$/, '$1');
        // make sure first letter is uppercase
        return newName[0].toUpperCase() + newName.substr(1);
    }
}

const beginOfDocumentRange = Range.create(Position.create(0, 0), Position.create(0, 0));
