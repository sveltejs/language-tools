import ts from 'typescript';
import {
    CompletionContext,
    CompletionList,
    CompletionTriggerKind,
    MarkupContent,
    MarkupKind,
    Position,
    Range,
    TextDocumentIdentifier,
    TextEdit
} from 'vscode-languageserver';
import {
    Document,
    getNodeIfIsInHTMLStartTag,
    getWordRangeAt,
    isInTag,
    mapCompletionItemToOriginal,
    mapRangeToOriginal,
    toRange
} from '../../../lib/documents';
import { flatten, getRegExpMatches, isNotNullOrUndefined, pathToUrl } from '../../../utils';
import { AppCompletionItem, AppCompletionList, CompletionsProvider } from '../../interfaces';
import { SvelteDocumentSnapshot, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../previewer';
import {
    convertRange,
    getCommitCharactersForScriptElement,
    scriptElementKindToCompletionItemKind
} from '../utils';
import { getJsDocTemplateCompletion } from './getJsDocTemplateCompletion';
import { getComponentAtPosition } from './utils';

export interface CompletionEntryWithIdentifer extends ts.CompletionEntry, TextDocumentIdentifier {
    position: Position;
}

type validTriggerCharacter = '.' | '"' | "'" | '`' | '/' | '@' | '<' | '#';

export class CompletionsProviderImpl implements CompletionsProvider<CompletionEntryWithIdentifer> {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    /**
     * The language service throws an error if the character is not a valid trigger character.
     * Also, the completions are worse.
     * Therefore, only use the characters the typescript compiler treats as valid.
     */
    private readonly validTriggerCharacters = ['.', '"', "'", '`', '/', '@', '<', '#'] as const;

    private isValidTriggerCharacter(
        character: string | undefined
    ): character is validTriggerCharacter {
        return this.validTriggerCharacters.includes(character as validTriggerCharacter);
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null> {
        if (isInTag(position, document.styleInfo)) {
            return null;
        }

        const { lang, tsDoc, userPreferences } = await this.lsAndTsDocResolver.getLSAndTSDoc(
            document
        );

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
        const isJsDocTriggerCharacter = triggerCharacter === '*';
        const isEventTriggerCharacter = triggerCharacter === ':';

        // ignore any custom trigger character specified in server capabilities
        //  and is not allow by ts
        if (
            isCustomTriggerCharacter &&
            !validTriggerCharacter &&
            !isJsDocTriggerCharacter &&
            !isEventTriggerCharacter
        ) {
            return null;
        }

        const fragment = await tsDoc.getFragment();
        if (!fragment.isInGenerated(position)) {
            return null;
        }

        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));

        if (isJsDocTriggerCharacter) {
            return getJsDocTemplateCompletion(fragment, lang, filePath, offset);
        }

        const eventCompletions = await this.getEventCompletions(
            lang,
            document,
            tsDoc,
            fragment,
            position
        );

        if (isEventTriggerCharacter) {
            return CompletionList.create(eventCompletions, !!tsDoc.parserError);
        }

        const completions =
            lang.getCompletionsAtPosition(filePath, offset, {
                ...userPreferences,
                triggerCharacter: validTriggerCharacter
            })?.entries || [];

        if (completions.length === 0 && eventCompletions.length === 0) {
            return tsDoc.parserError ? CompletionList.create([], true) : null;
        }

        const existingImports = this.getExistingImports(document);
        const completionItems = completions
            .filter(isValidCompletion(document, position))
            .map((comp) =>
                this.toCompletionItem(
                    fragment,
                    comp,
                    pathToUrl(tsDoc.filePath),
                    position,
                    existingImports
                )
            )
            .filter(isNotNullOrUndefined)
            .map((comp) => mapCompletionItemToOriginal(fragment, comp))
            .concat(eventCompletions);

        return CompletionList.create(completionItems, !!tsDoc.parserError);
    }

    private getExistingImports(document: Document) {
        const rawImports = getRegExpMatches(scriptImportRegex, document.getText()).map((match) =>
            (match[1] ?? match[2]).split(',')
        );
        const tidiedImports = flatten(rawImports).map((match) => match.trim());
        return new Set(tidiedImports);
    }

    private async getEventCompletions(
        lang: ts.LanguageService,
        doc: Document,
        tsDoc: SvelteDocumentSnapshot,
        fragment: SvelteSnapshotFragment,
        originalPosition: Position
    ): Promise<Array<AppCompletionItem<CompletionEntryWithIdentifer>>> {
        const snapshot = await getComponentAtPosition(
            this.lsAndTsDocResolver,
            lang,
            doc,
            tsDoc,
            fragment,
            originalPosition
        );
        if (!snapshot) {
            return [];
        }

        const offset = doc.offsetAt(originalPosition);
        const { start, end } = getWordRangeAt(doc.getText(), offset, {
            left: /\S+$/,
            right: /[^\w$:]/
        });

        return snapshot.getEvents().map((event) => {
            const eventName = 'on:' + event.name;
            return {
                label: eventName,
                sortText: '-1',
                detail: event.name + ': ' + event.type,
                documentation: event.doc && { kind: MarkupKind.Markdown, value: event.doc },
                textEdit:
                    start !== end
                        ? TextEdit.replace(toRange(doc.getText(), start, end), eventName)
                        : undefined
            };
        });
    }

    private toCompletionItem(
        fragment: SvelteSnapshotFragment,
        comp: ts.CompletionEntry,
        uri: string,
        position: Position,
        existingImports: Set<string>
    ): AppCompletionItem<CompletionEntryWithIdentifer> | null {
        const completionLabelAndInsert = this.getCompletionLabelAndInsert(fragment, comp);
        if (!completionLabelAndInsert) {
            return null;
        }

        const { label, insertText, isSvelteComp } = completionLabelAndInsert;
        // TS may suggest another Svelte component even if there already exists an import
        // with the same name, because under the hood every Svelte component is postfixed
        // with `__SvelteComponent`. In this case, filter out this completion by returning null.
        if (isSvelteComp && existingImports.has(label)) {
            return null;
        }

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
                position
            }
        };
    }

    private getCompletionLabelAndInsert(
        fragment: SvelteSnapshotFragment,
        comp: ts.CompletionEntry
    ) {
        let { kind, kindModifiers, name, source } = comp;
        const isScriptElement = kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);
        const isSvelteComp = this.isSvelteComponentImport(name);
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
                isSvelteComp
            };
        }

        return {
            label: name,
            isSvelteComp
        };
    }

    private isExistingSvelteComponentImport(
        fragment: SvelteSnapshotFragment,
        name: string,
        source?: string
    ): boolean {
        const importStatement = new RegExp(`import ${name} from ["'\`][\\s\\S]+\\.svelte["'\`]`);
        return !!source && !!fragment.text.match(importStatement);
    }

    async resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionEntryWithIdentifer>
    ): Promise<AppCompletionItem<CompletionEntryWithIdentifer>> {
        const { data: comp } = completionItem;
        const { tsDoc, lang, userPreferences } = await this.lsAndTsDocResolver.getLSAndTSDoc(
            document
        );

        const filePath = tsDoc.filePath;

        if (!comp || !filePath) {
            return completionItem;
        }

        const fragment = await tsDoc.getFragment();
        const detail = lang.getCompletionEntryDetails(
            filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(comp.position)),
            comp.name,
            {},
            comp.source,
            userPreferences
        );

        if (detail) {
            const { detail: itemDetail, documentation: itemDocumentation } =
                this.getCompletionDocument(detail);

            completionItem.detail = itemDetail;
            completionItem.documentation = itemDocumentation;
        }

        const actions = detail?.codeActions;
        const isImport = !!detail?.source;

        if (actions) {
            const edit: TextEdit[] = [];

            for (const action of actions) {
                for (const change of action.changes) {
                    edit.push(
                        ...this.codeActionChangesToTextEdit(
                            document,
                            fragment,
                            change,
                            isImport,
                            isInTag(comp.position, document.scriptInfo) ||
                                isInTag(comp.position, document.moduleScriptInfo)
                        )
                    );
                }
            }

            completionItem.additionalTextEdits = edit;
        }

        return completionItem;
    }

    private getCompletionDocument(compDetail: ts.CompletionEntryDetails) {
        const { source, documentation: tsDocumentation, displayParts, tags } = compDetail;
        let detail: string = this.changeSvelteComponentName(ts.displayPartsToString(displayParts));

        if (source) {
            const importPath = ts.displayPartsToString(source);
            detail = `Auto import from ${importPath}\n${detail}`;
        }

        const markdownDoc = getMarkdownDocumentation(tsDocumentation, tags);
        const documentation: MarkupContent | undefined = markdownDoc
            ? { value: markdownDoc, kind: MarkupKind.Markdown }
            : undefined;

        return {
            documentation,
            detail
        };
    }

    private codeActionChangesToTextEdit(
        doc: Document,
        fragment: SvelteSnapshotFragment,
        changes: ts.FileTextChanges,
        isImport: boolean,
        actionTriggeredInScript: boolean
    ): TextEdit[] {
        return changes.textChanges.map((change) =>
            this.codeActionChangeToTextEdit(
                doc,
                fragment,
                change,
                isImport,
                actionTriggeredInScript
            )
        );
    }

    codeActionChangeToTextEdit(
        doc: Document,
        fragment: SvelteSnapshotFragment,
        change: ts.TextChange,
        isImport: boolean,
        actionTriggeredInScript: boolean
    ): TextEdit {
        change.newText = this.changeComponentImport(change.newText, actionTriggeredInScript);

        const scriptTagInfo = fragment.scriptInfo;
        if (!scriptTagInfo) {
            // no script tag defined yet, add it.
            return TextEdit.replace(
                beginOfDocumentRange,
                `<script>${ts.sys.newLine}${change.newText}</script>${ts.sys.newLine}`
            );
        }

        const { span } = change;

        const virtualRange = convertRange(fragment, span);
        let range: Range;
        const isNewImport = isImport && virtualRange.start.character === 0;

        // Since new import always can't be mapped, we'll have special treatment here
        //  but only hack this when there is multiple line in script
        if (isNewImport && virtualRange.start.line > 1) {
            range = this.mapRangeForNewImport(fragment, virtualRange);
        } else {
            range = mapRangeToOriginal(fragment, virtualRange);
        }

        // If range is somehow not mapped in parent,
        // the import is mapped wrong or is outside script tag,
        // use script starting point instead.
        // This happens among other things if the completion is the first import of the file.
        if (
            range.start.line === -1 ||
            (range.start.line === 0 && range.start.character <= 1 && span.length === 0) ||
            !isInTag(range.start, scriptTagInfo)
        ) {
            range = convertRange(doc, {
                start: scriptTagInfo.start,
                length: span.length
            });
        }
        // prevent newText from being placed like this: <script>import {} from ''
        if (
            doc.offsetAt(range.start) === scriptTagInfo.start &&
            !change.newText.startsWith('\r\n') &&
            !change.newText.startsWith('\n')
        ) {
            change.newText = ts.sys.newLine + change.newText;
        }

        return TextEdit.replace(range, change.newText);
    }

    private mapRangeForNewImport(fragment: SvelteSnapshotFragment, virtualRange: Range) {
        const sourceMappableRange = this.offsetLinesAndMovetoStartOfLine(virtualRange, -1);
        const mappableRange = mapRangeToOriginal(fragment, sourceMappableRange);
        return this.offsetLinesAndMovetoStartOfLine(mappableRange, 1);
    }

    private offsetLinesAndMovetoStartOfLine({ start, end }: Range, offsetLines: number) {
        return Range.create(
            Position.create(start.line + offsetLines, 0),
            Position.create(end.line + offsetLines, 0)
        );
    }

    private isSvelteComponentImport(className: string) {
        return className.endsWith('__SvelteComponent_');
    }

    private changeSvelteComponentName(name: string) {
        return name.replace(/(\w+)__SvelteComponent_/, '$1');
    }

    private changeComponentImport(importText: string, actionTriggeredInScript: boolean) {
        const changedName = this.changeSvelteComponentName(importText);
        if (importText !== changedName || !actionTriggeredInScript) {
            // For some reason, TS sometimes adds the `type` modifier. Remove it
            // in case of Svelte component imports or if import triggered from markup.
            return changedName.replace(' type ', ' ');
        }

        return importText;
    }
}

const beginOfDocumentRange = Range.create(Position.create(0, 0), Position.create(0, 0));

// `import {...} from '..'` or `import ... from '..'`
// Note: Does not take into account if import is within a comment.
// eslint-disable-next-line max-len
const scriptImportRegex =
    /\bimport\s+{([^}]*?)}\s+?from\s+['"`].+?['"`]|\bimport\s+(\w+?)\s+from\s+['"`].+?['"`]/g;

const completionBlacklist = new Set(['sveltekitPrefetch', 'sveltekitNoscroll']);

function isValidCompletion(
    document: Document,
    position: Position
): (value: ts.CompletionEntry) => boolean {
    const isCompletionInHTMLStartTag = !!getNodeIfIsInHTMLStartTag(
        document.html,
        document.offsetAt(position)
    );
    if (!isCompletionInHTMLStartTag) {
        return () => true;
    }
    return (value) =>
        !completionBlacklist.has(value.name) &&
        // remove attribues starting with "on" because those are events.
        // Svelte wants events of the form "on:X", but the suggestions
        // are of the form "onX". Moreover, they are doubled by the HTML
        // attribute suggestions. Therefore filter them out.
        !value.name.startsWith('on');
}
