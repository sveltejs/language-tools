import { basename, dirname } from 'path';
import ts from 'typescript';
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    CompletionTriggerKind,
    InsertTextFormat,
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
    getNodeIfIsInStartTag,
    getWordRangeAt,
    isInTag,
    mapCompletionItemToOriginal,
    mapRangeToOriginal,
    toRange
} from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { LSConfigManager } from '../../../ls-config';
import { flatten, getRegExpMatches, modifyLines, pathToUrl } from '../../../utils';
import { AppCompletionItem, AppCompletionList, CompletionsProvider } from '../../interfaces';
import { ComponentInfoProvider, ComponentPartInfo } from '../ComponentInfoProvider';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../previewer';
import {
    changeSvelteComponentName,
    convertRange,
    isInScript,
    isGeneratedSvelteComponentName,
    scriptElementKindToCompletionItemKind
} from '../utils';
import { getJsDocTemplateCompletion } from './getJsDocTemplateCompletion';
import {
    getComponentAtPosition,
    getFormatCodeBasis,
    getNewScriptStartTag,
    isKitTypePath,
    isPartOfImportStatement
} from './utils';
import { isInTag as svelteIsInTag } from '../svelte-ast-utils';
import { LanguageServiceContainer } from '../service';

export interface CompletionResolveInfo
    extends Pick<ts.CompletionEntry, 'data' | 'name' | 'source'>,
        TextDocumentIdentifier {
    position: Position;
    __is_sveltekit$typeImport?: boolean;
}

type validTriggerCharacter = '.' | '"' | "'" | '`' | '/' | '@' | '<' | '#';

type LastCompletion = {
    key: string;
    position: Position;
    completionList: AppCompletionList<CompletionResolveInfo> | null;
};

interface CommitCharactersOptions {
    checkCommitCharacters: boolean;
    defaultCommitCharacters?: string[];
    isNewIdentifierLocation?: boolean;
}

export class CompletionsProviderImpl implements CompletionsProvider<CompletionResolveInfo> {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {}

    /**
     * The language service throws an error if the character is not a valid trigger character.
     * Also, the completions are worse.
     * Therefore, only use the characters the typescript compiler treats as valid.
     */
    private readonly validTriggerCharacters = ['.', '"', "'", '`', '/', '@', '<', '#'] as const;
    private commitCharacters = ['.', ',', ';', '('];
    /**
     * For performance reasons, try to reuse the last completion if possible.
     */
    private lastCompletion?: LastCompletion;

    private isValidTriggerCharacter(
        character: string | undefined
    ): character is validTriggerCharacter {
        return this.validTriggerCharacters.includes(character as validTriggerCharacter);
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<AppCompletionList<CompletionResolveInfo> | null> {
        if (isInTag(position, document.styleInfo)) {
            return null;
        }

        const {
            lang: langForSyntheticOperations,
            tsDoc,
            userPreferences
        } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

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
        const isEventOrSlotLetTriggerCharacter = triggerCharacter === ':';

        // ignore any custom trigger character specified in server capabilities
        //  and is not allow by ts
        if (
            isCustomTriggerCharacter &&
            !validTriggerCharacter &&
            !isJsDocTriggerCharacter &&
            !isEventOrSlotLetTriggerCharacter
        ) {
            return null;
        }

        if (
            this.canReuseLastCompletion(
                this.lastCompletion,
                triggerKind,
                triggerCharacter,
                document,
                position
            )
        ) {
            this.lastCompletion.position = position;
            return this.lastCompletion.completionList;
        } else {
            this.lastCompletion = undefined;
        }

        if (!tsDoc.isInGenerated(position)) {
            return null;
        }

        const originalOffset = document.offsetAt(position);
        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

        if (isJsDocTriggerCharacter) {
            return getJsDocTemplateCompletion(tsDoc, langForSyntheticOperations, filePath, offset);
        }

        const svelteNode = tsDoc.svelteNodeAt(originalOffset);
        if (
            // Cursor is somewhere in regular HTML text
            (svelteNode?.type === 'Text' &&
                ['Element', 'InlineComponent', 'Fragment', 'SlotTemplate'].includes(
                    svelteNode.parent?.type as any
                )) ||
            // Cursor is at <div>|</div> in which case there's no TextNode inbetween
            document.getText().substring(originalOffset - 1, originalOffset + 2) === '></'
        ) {
            return null;
        }

        const { lang, lsContainer } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);
        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const wordInfo = this.getWordAtPosition(document, originalOffset);

        const componentInfo = getComponentAtPosition(lang, document, tsDoc, position);
        const attributeContext = componentInfo && getAttributeContextAtPosition(document, position);
        const eventAndSlotLetCompletions = this.getEventAndSlotLetCompletions(
            componentInfo,
            attributeContext,
            wordInfo.defaultTextEditRange
        );

        if (isEventOrSlotLetTriggerCharacter) {
            return CompletionList.create(eventAndSlotLetCompletions, !!tsDoc.parserError);
        }

        const tagCompletions =
            componentInfo || eventAndSlotLetCompletions.length > 0
                ? []
                : this.getCustomElementCompletions(lang, lsContainer, document, tsDoc, position);

        const formatSettings = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );
        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        // one or two characters after start tag might be mapped to the component name
        if (
            svelteNode?.type === 'InlineComponent' &&
            'name' in svelteNode &&
            typeof svelteNode.name === 'string'
        ) {
            const name = svelteNode.name;
            const nameEnd = svelteNode.start + 1 + name.length;
            const isWhitespaceAfterStartTag =
                document.getText().slice(nameEnd, originalOffset).trim() === '' &&
                this.mightBeAtStartTagWhitespace(document, originalOffset);

            if (isWhitespaceAfterStartTag) {
                // We can be sure only to get completions for directives and props here
                // so don't bother with the expensive global completions
                return this.getCompletionListForDirectiveOrProps(
                    attributeContext,
                    componentInfo,
                    wordInfo.defaultTextEditRange,
                    eventAndSlotLetCompletions,
                    tsDoc
                );
            }
        }

        const response = lang.getCompletionsAtPosition(
            filePath,
            offset,
            {
                ...userPreferences,
                triggerCharacter: validTriggerCharacter
            },
            formatSettings
        );

        const commitCharactersOptions = this.getCommitCharactersOptions(response, tsDoc, position);
        let completions = response?.entries || [];

        const customCompletions = eventAndSlotLetCompletions.concat(tagCompletions ?? []);
        if (completions.length === 0 && customCompletions.length === 0) {
            return tsDoc.parserError ? CompletionList.create([], true) : null;
        }

        if (
            completions.length > 500 &&
            svelteNode?.type === 'Element' &&
            completions[0].kind !== ts.ScriptElementKind.memberVariableElement
        ) {
            // False global completions inside element start tag
            return null;
        }

        if (
            completions.length > 500 &&
            svelteNode?.type === 'InlineComponent' &&
            this.mightBeAtStartTagWhitespace(document, originalOffset)
        ) {
            // Very likely false global completions inside component start tag -> narrow
            return this.getCompletionListForDirectiveOrProps(
                attributeContext,
                componentInfo,
                wordInfo.defaultTextEditRange,
                eventAndSlotLetCompletions,
                tsDoc
            );
        }

        // moved here due to perf reasons
        const existingImports = this.getExistingImports(document);
        const fileUrl = pathToUrl(tsDoc.filePath);
        const isCompletionInTag = svelteIsInTag(svelteNode, originalOffset);
        const isHandlerCompletion =
            svelteNode?.type === 'EventHandler' && svelteNode.parent?.type === 'Element';

        const completionItems: CompletionItem[] = customCompletions;
        const isValidCompletion = createIsValidCompletion(document, position, !!tsDoc.parserError);
        const addCompletion = (entry: ts.CompletionEntry, asStore: boolean) => {
            if (isValidCompletion(entry)) {
                let completion = this.toCompletionItem(
                    tsDoc,
                    entry,
                    fileUrl,
                    position,
                    isCompletionInTag,
                    commitCharactersOptions,
                    asStore,
                    existingImports
                );
                if (completion) {
                    completionItems.push(
                        this.fixTextEditRange(
                            wordInfo.range,
                            mapCompletionItemToOriginal(tsDoc, completion),
                            isHandlerCompletion
                        )
                    );
                }
            }
        };

        // If completion is about a store which is not imported yet, do another
        // completion request at the beginning of the file to get all global
        // import completions and then filter them down to likely matches.
        if (wordInfo.word.charAt(0) === '$') {
            const storeName = wordInfo.word.substring(1);
            const text = '__sveltets_2_store_get(' + storeName;
            if (!tsDoc.getFullText().includes(text)) {
                const pos = (tsDoc.scriptInfo || tsDoc.moduleScriptInfo)?.endPos ?? {
                    line: 0,
                    character: 0
                };
                const virtualOffset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(pos));
                const storeCompletions = lang.getCompletionsAtPosition(
                    filePath,
                    virtualOffset,
                    {
                        ...userPreferences,
                        triggerCharacter: validTriggerCharacter
                    },
                    formatSettings
                );
                for (const entry of storeCompletions?.entries || []) {
                    if (entry.name.startsWith(storeName)) {
                        addCompletion(entry, true);
                    }
                }
            }
        }

        for (const entry of completions) {
            addCompletion(entry, false);
        }

        // Add ./$types imports for SvelteKit since TypeScript is bad at it
        if (basename(filePath).startsWith('+')) {
            const $typeImports = new Map<string, CompletionItem>();
            for (const c of completionItems) {
                if (isKitTypePath(c.data?.source)) {
                    $typeImports.set(c.label, c);
                }
            }
            for (const $typeImport of $typeImports.values()) {
                // resolve path from filePath to svelte-kit/types
                // src/routes/foo/+page.svelte -> .svelte-kit/types/foo/$types.d.ts
                const routesFolder = document.config?.kit?.files?.routes || 'src/routes';
                const relativeFileName = filePath.split(routesFolder)[1]?.slice(1);
                if (relativeFileName) {
                    const relativePath =
                        dirname(relativeFileName) === '.' ? '' : `${dirname(relativeFileName)}/`;
                    const modifiedSource =
                        $typeImport.data.source.split('.svelte-kit/types')[0] +
                        // note the missing .d.ts at the end - TS wants it that way for some reason
                        `.svelte-kit/types/${routesFolder}/${relativePath}$types`;
                    completionItems.push({
                        ...$typeImport,
                        // Ensure it's sorted above the other imports
                        sortText: !isNaN(Number($typeImport.sortText))
                            ? String(Number($typeImport.sortText) - 1)
                            : $typeImport.sortText,
                        data: {
                            ...$typeImport.data,
                            __is_sveltekit$typeImport: true,
                            source: modifiedSource,
                            data: undefined
                        }
                    });
                }
            }
        }

        const completionList = CompletionList.create(completionItems, !!tsDoc.parserError);
        if (
            commitCharactersOptions.checkCommitCharacters &&
            commitCharactersOptions.defaultCommitCharacters?.length
        ) {
            const clientSupportsItemsDefault = this.configManager
                .getClientCapabilities()
                ?.textDocument?.completion?.completionList?.itemDefaults?.includes(
                    'commitCharacters'
                );

            if (clientSupportsItemsDefault) {
                completionList.itemDefaults = {
                    commitCharacters: commitCharactersOptions.defaultCommitCharacters
                };
            } else {
                completionList.items.forEach((item) => {
                    item.commitCharacters ??= commitCharactersOptions.defaultCommitCharacters;
                });
            }
        }

        this.lastCompletion = { key: document.getFilePath() || '', position, completionList };

        return completionList;
    }

    private getWordAtPosition(document: Document, offset: number) {
        const wordRange = getWordRangeAt(document.getText(), offset, {
            left: /[^\s.]+$/,
            right: /[^\w$:]/
        });

        const range = Range.create(
            document.positionAt(wordRange.start),
            document.positionAt(wordRange.end)
        );

        return {
            wordRange,
            word: document.getText().slice(wordRange.start, wordRange.end),
            range,
            defaultTextEditRange: wordRange.start === wordRange.end ? undefined : range
        };
    }

    private mightBeAtStartTagWhitespace(document: Document, originalOffset: number) {
        return /\s[\s>/]/.test(
            document.getText().substring(originalOffset - 1, originalOffset + 1)
        );
    }

    private canReuseLastCompletion(
        lastCompletion: LastCompletion | undefined,
        triggerKind: number | undefined,
        triggerCharacter: string | undefined,
        document: Document,
        position: Position
    ): lastCompletion is LastCompletion {
        return (
            !!lastCompletion &&
            lastCompletion.key === document.getFilePath() &&
            lastCompletion.position.line === position.line &&
            ((Math.abs(lastCompletion.position.character - position.character) < 2 &&
                (triggerKind === CompletionTriggerKind.TriggerForIncompleteCompletions ||
                    // Special case: `.` is a trigger character, but inside import path completions
                    // it shouldn't trigger another completion because we can reuse the old one
                    (triggerCharacter === '.' &&
                        isPartOfImportStatement(document.getText(), position)))) ||
                // `let:` or `on:` -> up to 3 previous characters allowed
                (Math.abs(lastCompletion.position.character - position.character) < 4 &&
                    triggerCharacter === ':' &&
                    !!getNodeIfIsInStartTag(document.html, document.offsetAt(position))))
        );
    }

    private getExistingImports(document: Document) {
        const rawImports = getRegExpMatches(scriptImportRegex, document.getText()).map((match) =>
            (match[1] ?? match[2]).split(',')
        );
        const tidiedImports = flatten(rawImports).map((match) => match.trim());
        return new Set(tidiedImports);
    }

    private getEventAndSlotLetCompletions(
        componentInfo: ComponentInfoProvider | null,
        attributeContext: AttributeContext | null,
        defaultTextEditRange: Range | undefined
    ): Array<AppCompletionItem<CompletionResolveInfo>> {
        if (componentInfo === null) {
            return [];
        }

        if (attributeContext?.inValue) {
            return [];
        }

        return [
            ...componentInfo
                .getEvents()
                .map((event) =>
                    this.componentInfoToCompletionEntry(
                        event,
                        'on:',
                        undefined,
                        defaultTextEditRange
                    )
                ),
            ...componentInfo
                .getSlotLets()
                .map((slot) =>
                    this.componentInfoToCompletionEntry(
                        slot,
                        'let:',
                        undefined,
                        defaultTextEditRange
                    )
                )
        ];
    }

    private getCustomElementCompletions(
        lang: ts.LanguageService,
        lsContainer: LanguageServiceContainer,
        document: Document,
        tsDoc: SvelteDocumentSnapshot,
        position: Position
    ): CompletionItem[] | undefined {
        const offset = document.offsetAt(position);
        const tag = getNodeIfIsInHTMLStartTag(document.html, offset);

        if (!tag) {
            return;
        }

        const tagNameEnd = tag.start + 1 + (tag.tag?.length ?? 0);
        if (offset > tagNameEnd) {
            return;
        }

        const program = lang.getProgram();
        const sourceFile = program?.getSourceFile(tsDoc.filePath);
        const typeChecker = program?.getTypeChecker();
        if (!typeChecker || !sourceFile) {
            return;
        }

        const typingsNamespace = lsContainer.getTsConfigSvelteOptions().namespace;

        const typingsNamespaceSymbol = this.findTypingsNamespaceSymbol(
            typingsNamespace,
            typeChecker,
            sourceFile
        );

        if (!typingsNamespaceSymbol) {
            return;
        }

        const elements = typeChecker
            .getExportsOfModule(typingsNamespaceSymbol)
            .find((symbol) => symbol.name === 'IntrinsicElements');

        if (!elements || !(elements.flags & ts.SymbolFlags.Interface)) {
            return;
        }

        let tagNames: string[] = typeChecker
            .getDeclaredTypeOfSymbol(elements)
            .getProperties()
            .map((p) => ts.symbolName(p));

        if (tagNames.length && tag.tag) {
            tagNames = tagNames.filter((name) => name.startsWith(tag.tag ?? ''));
        }

        const replacementRange = toRange(document, tag.start + 1, tagNameEnd);

        return tagNames.map((name) => ({
            label: name,
            kind: CompletionItemKind.Property,
            textEdit: TextEdit.replace(this.cloneRange(replacementRange), name)
        }));
    }

    private findTypingsNamespaceSymbol(
        namespaceExpression: string,
        typeChecker: ts.TypeChecker,
        sourceFile: ts.SourceFile
    ) {
        if (!namespaceExpression || typeof namespaceExpression !== 'string') {
            return;
        }

        const [first, ...rest] = namespaceExpression.split('.');

        let symbol: ts.Symbol | undefined = typeChecker
            .getSymbolsInScope(sourceFile, ts.SymbolFlags.Namespace)
            .find((symbol) => symbol.name === first);

        for (const part of rest) {
            if (!symbol) {
                return;
            }

            symbol = typeChecker.getExportsOfModule(symbol).find((symbol) => symbol.name === part);
        }

        return symbol;
    }

    private componentInfoToCompletionEntry(
        info: ComponentPartInfo[0],
        prefix: string,
        kind: CompletionItemKind | undefined,
        defaultTextEditRange: Range | undefined
    ): AppCompletionItem<CompletionResolveInfo> {
        const name = prefix + info.name;
        return {
            label: name,
            kind,
            sortText: '-1',
            detail: info.name + ': ' + info.type,
            documentation: info.doc && { kind: MarkupKind.Markdown, value: info.doc },
            commitCharacters: [],
            textEdit: defaultTextEditRange
                ? TextEdit.replace(this.cloneRange(defaultTextEditRange), name)
                : undefined
        };
    }

    private cloneRange(range: Range) {
        return Range.create(
            Position.create(range.start.line, range.start.character),
            Position.create(range.end.line, range.end.character)
        );
    }

    private getCompletionListForDirectiveOrProps(
        attributeContext: AttributeContext | null,
        componentInfo: ComponentInfoProvider | null,
        defaultTextEditRange: Range | undefined,
        eventAndSlotLetCompletions: AppCompletionItem<CompletionResolveInfo>[],
        tsDoc: SvelteDocumentSnapshot
    ) {
        const props =
            (!attributeContext?.inValue &&
                componentInfo
                    ?.getProps()
                    .map((entry) =>
                        this.componentInfoToCompletionEntry(
                            entry,
                            '',
                            CompletionItemKind.Field,
                            defaultTextEditRange
                        )
                    )) ||
            [];
        return CompletionList.create(
            [...eventAndSlotLetCompletions, ...props],
            !!tsDoc.parserError
        );
    }

    private toCompletionItem(
        snapshot: SvelteDocumentSnapshot,
        comp: ts.CompletionEntry,
        uri: string,
        position: Position,
        isCompletionInTag: boolean,
        commitCharactersOptions: CommitCharactersOptions,
        asStore: boolean,
        existingImports: Set<string>
    ): AppCompletionItem<CompletionResolveInfo> | null {
        const completionLabelAndInsert = this.getCompletionLabelAndInsert(snapshot, comp);
        if (!completionLabelAndInsert) {
            return null;
        }

        let { label, insertText, isSvelteComp, isRunesCompletion, replacementSpan } =
            completionLabelAndInsert;
        // TS may suggest another Svelte component even if there already exists an import
        // with the same name, because under the hood every Svelte component is postfixed
        // with `__SvelteComponent`. In this case, filter out this completion by returning null.
        if (isSvelteComp && existingImports.has(label)) {
            return null;
        }
        // Remove wrong quotes, for example when using --css-props
        if (
            isCompletionInTag &&
            !insertText &&
            label[0] === '"' &&
            label[label.length - 1] === '"'
        ) {
            label = label.slice(1, -1);
        } else if (asStore) {
            // only modify label, so that the data property is untouched, which is important so the resolving still works
            label = `$${label}`;
        }

        const textEdit = replacementSpan
            ? TextEdit.replace(convertRange(snapshot, replacementSpan), insertText ?? label)
            : undefined;

        const labelDetails =
            comp.labelDetails ??
            (comp.sourceDisplay
                ? {
                      description: ts.displayPartsToString(comp.sourceDisplay)
                  }
                : undefined);

        return {
            label,
            insertText,
            kind: scriptElementKindToCompletionItemKind(comp.kind),
            commitCharacters: this.getCommitCharacters(comp, commitCharactersOptions, isSvelteComp),
            // Make sure svelte component and runes take precedence
            sortText: isRunesCompletion || isSvelteComp ? '-1' : comp.sortText,
            preselect: isRunesCompletion || isSvelteComp ? true : comp.isRecommended,
            insertTextFormat: comp.isSnippet ? InsertTextFormat.Snippet : undefined,
            labelDetails,
            textEdit,
            // pass essential data for resolving completion
            data: {
                name: comp.name,
                source: comp.source,
                data: comp.data,
                uri,
                position
            }
        };
    }

    private getCompletionLabelAndInsert(
        snapshot: SvelteDocumentSnapshot,
        comp: ts.CompletionEntry
    ) {
        let { name, insertText, kindModifiers } = comp;
        const isScriptElement = comp.kind === ts.ScriptElementKind.scriptElement;
        const hasModifier = Boolean(comp.kindModifiers);
        const isRunesCompletion =
            name === '$props' || name === '$state' || name === '$derived' || name === '$effect';
        const isSvelteComp = !isRunesCompletion && isGeneratedSvelteComponentName(name);
        if (isSvelteComp) {
            name = changeSvelteComponentName(name);

            if (this.isExistingSvelteComponentImport(snapshot, name, comp.source)) {
                return null;
            }
        }

        if (isScriptElement && hasModifier) {
            const label =
                kindModifiers && !name.endsWith(kindModifiers) ? name + kindModifiers : name;
            return {
                insertText: name,
                label,
                isSvelteComp,
                isRunesCompletion
            };
        }

        if (comp.replacementSpan) {
            return {
                label: name,
                isSvelteComp,
                isRunesCompletion,
                insertText: insertText ? changeSvelteComponentName(insertText) : undefined,
                replacementSpan: comp.replacementSpan
            };
        }

        return {
            label: name,
            insertText,
            isSvelteComp,
            isRunesCompletion
        };
    }

    private getCommitCharactersOptions(
        response: ts.CompletionInfo | undefined,
        tsDoc: SvelteDocumentSnapshot,
        position: Position
    ): CommitCharactersOptions {
        if ((!isInScript(position, tsDoc) && tsDoc.parserError) || !response) {
            return {
                checkCommitCharacters: false
            };
        }

        const isNewIdentifierLocation = response.isNewIdentifierLocation;
        let defaultCommitCharacters = response.defaultCommitCharacters;
        if (!isNewIdentifierLocation) {
            // This actually always exists although it's optional in the type, at least in ts 5.6,
            // so our commit characters are mostly fallback for older ts versions
            if (defaultCommitCharacters) {
                // this is controlled by a vscode setting that isn't available in the ts server so it isn't added to the language service
                defaultCommitCharacters?.push('(');
            } else {
                defaultCommitCharacters = this.commitCharacters;
            }
        }

        return {
            checkCommitCharacters: true,
            defaultCommitCharacters,
            isNewIdentifierLocation
        };
    }

    private getCommitCharacters(
        entry: ts.CompletionEntry,
        options: CommitCharactersOptions,
        isSvelteComp: boolean
    ) {
        // Because Svelte components take precedence, we leave out commit characters to not auto complete
        // in weird places (e.g. when you have foo.filter(a => a)) and get autocomplete for component A,
        // then a commit character of `.` would auto import the component which is not what we want
        if (isSvelteComp) {
            return ['>'];
        }

        // https://github.com/microsoft/vscode/blob/d012408e88ffabd6456c367df4d343654da2eb10/extensions/typescript-language-features/src/languageFeatures/completions.ts#L504
        if (!options.checkCommitCharacters) {
            return undefined;
        }

        const commitCharacters = entry.commitCharacters;
        // Ambient JS word based suggestions
        const skipCommitCharacters =
            entry.kind === ts.ScriptElementKind.warning ||
            entry.kind === ts.ScriptElementKind.string;

        if (commitCharacters) {
            if (!options.isNewIdentifierLocation && !skipCommitCharacters) {
                return commitCharacters.concat('(');
            }

            return commitCharacters;
        }

        return skipCommitCharacters ? [] : undefined;
    }

    private isExistingSvelteComponentImport(
        snapshot: SvelteDocumentSnapshot,
        name: string,
        source?: string
    ): boolean {
        const importStatement = new RegExp(`import ${name} from ["'\`][\\s\\S]+\\.svelte["'\`]`);
        return !!source && !!snapshot.getFullText().match(importStatement);
    }

    private fixTextEditRange(
        wordRange: Range,
        completionItem: CompletionItem,
        isHandlerCompletion: boolean
    ) {
        if (isHandlerCompletion && completionItem.label.startsWith('on:')) {
            completionItem.textEdit = TextEdit.replace(
                this.cloneRange(wordRange),
                completionItem.label
            );

            return completionItem;
        }

        const { textEdit } = completionItem;
        if (!textEdit || !TextEdit.is(textEdit)) {
            return completionItem;
        }

        const {
            newText,
            range: { start }
        } = textEdit;

        //If the textEdit is out of the word range of the triggered position
        // vscode would refuse to show the completions
        // split those edits into additionalTextEdit to fix it

        if (start.line !== wordRange.start.line || start.character > wordRange.start.character) {
            return completionItem;
        }

        textEdit.newText = newText.substring(wordRange.start.character - start.character);
        textEdit.range.start = {
            line: start.line,
            character: wordRange.start.character
        };
        completionItem.additionalTextEdits = [
            TextEdit.replace(
                {
                    start,
                    end: {
                        line: start.line,
                        character: wordRange.start.character
                    }
                },
                newText.substring(0, wordRange.start.character - start.character)
            )
        ];

        return completionItem;
    }

    /**
     * TypeScript throws a debug assertion error if the importModuleSpecifierEnding config is
     * 'js' and there's an unknown file extension - which is the case for `.svelte`. Therefore
     * rewrite the importModuleSpecifierEnding for this case to silence the error.
     */
    fixUserPreferencesForSvelteComponentImport(
        userPreferences: ts.UserPreferences
    ): ts.UserPreferences {
        if (userPreferences.importModuleSpecifierEnding === 'js') {
            return {
                ...userPreferences,
                importModuleSpecifierEnding: 'index'
            };
        }

        return userPreferences;
    }

    async resolveCompletion(
        document: Document,
        completionItem: AppCompletionItem<CompletionResolveInfo>,
        cancellationToken?: CancellationToken
    ): Promise<AppCompletionItem<CompletionResolveInfo>> {
        const { data: comp } = completionItem;
        const { tsDoc, lang, userPreferences } =
            await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        const filePath = tsDoc.filePath;

        const formatCodeOptions = await this.configManager.getFormatCodeSettingsForFile(
            document,
            tsDoc.scriptKind
        );
        if (!comp || !filePath || cancellationToken?.isCancellationRequested) {
            return completionItem;
        }

        const is$typeImport = !!comp.__is_sveltekit$typeImport;

        const errorPreventingUserPreferences = comp.source?.endsWith('.svelte')
            ? this.fixUserPreferencesForSvelteComponentImport(userPreferences)
            : userPreferences;

        const detail = lang.getCompletionEntryDetails(
            filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(comp.position)),
            comp.name,
            formatCodeOptions,
            comp.source,
            errorPreventingUserPreferences,
            comp.data
        );

        if (detail) {
            const { detail: itemDetail, documentation: itemDocumentation } =
                this.getCompletionDocument(tsDoc, detail, is$typeImport);

            // VSCode + tsserver won't have this pop-in effect
            // because tsserver has internal APIs for caching
            // TODO: consider if we should adopt the internal APIs
            if (detail.sourceDisplay && !completionItem.labelDetails) {
                completionItem.labelDetails = {
                    description: ts.displayPartsToString(detail.sourceDisplay)
                };
            }

            completionItem.detail = itemDetail;
            completionItem.documentation = itemDocumentation;
        }

        const actions = detail?.codeActions;
        const isImport = !!detail?.source;

        if (actions) {
            const edit: TextEdit[] = [];

            const formatCodeBasis = getFormatCodeBasis(formatCodeOptions);
            for (const action of actions) {
                for (const change of action.changes) {
                    edit.push(
                        ...this.codeActionChangesToTextEdit(
                            document,
                            tsDoc,
                            change,
                            isImport,
                            comp.position,
                            formatCodeBasis.newLine,
                            is$typeImport
                        )
                    );
                }
            }

            completionItem.additionalTextEdits = (completionItem.additionalTextEdits ?? []).concat(
                edit
            );
        }

        return completionItem;
    }

    private getCompletionDocument(
        tsDoc: SvelteDocumentSnapshot,
        compDetail: ts.CompletionEntryDetails,
        is$typeImport: boolean
    ) {
        const { sourceDisplay, documentation: tsDocumentation, displayParts, tags } = compDetail;
        let parts = compDetail.codeActions?.map((codeAction) => codeAction.description) ?? [];

        if (sourceDisplay && is$typeImport) {
            const importPath = ts.displayPartsToString(sourceDisplay);

            // Take into account Node16 moduleResolution
            parts = parts.map((detail) =>
                detail.replace(importPath, `'./$types${importPath.endsWith('.js') ? '.js' : ''}'`)
            );
        }

        let text = changeSvelteComponentName(ts.displayPartsToString(displayParts));
        if (tsDoc.isSvelte5Plus && text.includes('(alias)')) {
            // The info contains both the const and type export along with a bunch of gibberish we want to hide
            if (text.includes('__SvelteComponent_')) {
                // import - remove completely
                text = '';
            } else if (text.includes('__sveltets_2_IsomorphicComponent')) {
                // already imported - only keep the last part
                text = text.substring(text.lastIndexOf('import'));
            }
        }
        parts.push(text);

        const markdownDoc = getMarkdownDocumentation(tsDocumentation, tags);
        const documentation: MarkupContent | undefined = markdownDoc
            ? { value: markdownDoc, kind: MarkupKind.Markdown }
            : undefined;

        return {
            documentation,
            detail: parts.filter(Boolean).join('\n\n')
        };
    }

    private codeActionChangesToTextEdit(
        doc: Document,
        snapshot: SvelteDocumentSnapshot,
        changes: ts.FileTextChanges,
        isImport: boolean,
        originalTriggerPosition: Position,
        newLine: string,
        is$typeImport?: boolean
    ): TextEdit[] {
        return changes.textChanges.map((change) =>
            this.codeActionChangeToTextEdit(
                doc,
                snapshot,
                change,
                isImport,
                originalTriggerPosition,
                newLine,
                is$typeImport
            )
        );
    }

    codeActionChangeToTextEdit(
        doc: Document,
        snapshot: SvelteDocumentSnapshot,
        change: ts.TextChange,
        isImport: boolean,
        originalTriggerPosition: Position,
        newLine: string,
        is$typeImport?: boolean,
        isCombinedCodeAction?: boolean
    ): TextEdit {
        change.newText = isCombinedCodeAction
            ? modifyLines(change.newText, (line) =>
                  this.fixImportNewText(
                      line,
                      isInScript(originalTriggerPosition, doc),
                      is$typeImport
                  )
              )
            : this.fixImportNewText(
                  change.newText,
                  isInScript(originalTriggerPosition, doc),
                  is$typeImport
              );

        const scriptTagInfo = snapshot.scriptInfo || snapshot.moduleScriptInfo;
        // no script tag defined yet, add it.
        if (!scriptTagInfo) {
            if (isCombinedCodeAction) {
                return TextEdit.insert(Position.create(0, 0), change.newText);
            }

            const config = this.configManager.getConfig();
            return TextEdit.replace(
                beginOfDocumentRange,
                `${getNewScriptStartTag(config)}${change.newText}</script>${newLine}`
            );
        }

        const { span } = change;

        const virtualRange = convertRange(snapshot, span);
        let range: Range;
        const isNewImport = isImport && virtualRange.start.character === 0;

        // Since new import always can't be mapped, we'll have special treatment here
        //  but only hack this when there is multiple line in script
        if (isNewImport && virtualRange.start.line > 1) {
            range = this.mapRangeForNewImport(snapshot, virtualRange);
        } else {
            range = mapRangeToOriginal(snapshot, virtualRange);
        }

        // If range is somehow not mapped in parent,
        // the import is mapped wrong or is outside script tag,
        // use script starting point instead.
        // This happens among other things if the completion is the first import of the file.
        if (
            range.start.line === -1 ||
            (range.start.line === 0 && range.start.character <= 1 && span.length === 0) ||
            !isInScript(range.start, snapshot)
        ) {
            range = convertRange(doc, {
                start: isInTag(originalTriggerPosition, doc.scriptInfo)
                    ? snapshot.scriptInfo?.start || scriptTagInfo.start
                    : isInTag(originalTriggerPosition, doc.moduleScriptInfo)
                      ? snapshot.moduleScriptInfo?.start || scriptTagInfo.start
                      : scriptTagInfo.start,
                length: span.length
            });
        }
        // prevent newText from being placed like this: <script>import {} from ''
        const editOffset = doc.offsetAt(range.start);
        if (
            (editOffset === snapshot.scriptInfo?.start ||
                editOffset === snapshot.moduleScriptInfo?.start) &&
            !change.newText.startsWith('\r\n') &&
            !change.newText.startsWith('\n')
        ) {
            change.newText = newLine + change.newText;
        }

        const after = doc.getText().slice(doc.offsetAt(range.end));
        // typescript add empty line after import when the generated ts file
        // doesn't have new line at the start of the file
        if (after.startsWith('\r\n') || after.startsWith('\n')) {
            change.newText = change.newText.trimEnd() + newLine;
        }

        return TextEdit.replace(range, change.newText);
    }

    private mapRangeForNewImport(snapshot: SvelteDocumentSnapshot, virtualRange: Range) {
        const sourceMappableRange = this.offsetLinesAndMovetoStartOfLine(virtualRange, -1);
        const mappableRange = mapRangeToOriginal(snapshot, sourceMappableRange);
        return this.offsetLinesAndMovetoStartOfLine(mappableRange, 1);
    }

    private offsetLinesAndMovetoStartOfLine({ start, end }: Range, offsetLines: number) {
        return Range.create(
            Position.create(start.line + offsetLines, 0),
            Position.create(end.line + offsetLines, 0)
        );
    }

    private fixImportNewText(
        importText: string,
        actionTriggeredInScript: boolean,
        is$typeImport?: boolean
    ) {
        if (is$typeImport && importText.trim().startsWith('import ')) {
            // Take into account Node16 moduleResolution
            return importText.replace(
                /(['"])(.+?)['"]/,
                (_match, quote, path) =>
                    `${quote}./$types${path.endsWith('.js') ? '.js' : ''}${quote}`
            );
        }
        const changedName = changeSvelteComponentName(importText);
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
const scriptImportRegex =
    /\bimport\s+{([^}]*?)}\s+?from\s+['"`].+?['"`]|\bimport\s+(\w+?)\s+from\s+['"`].+?['"`]/g;

// Type definitions from svelte-shims.d.ts that shouldn't appear in completion suggestions
// because they are meant to be used "behind the scenes"
const svelte2tsxTypes = new Set([
    'Svelte2TsxComponent',
    'Svelte2TsxComponentConstructorParameters',
    'SvelteComponentConstructor',
    'SvelteActionReturnType',
    'SvelteTransitionConfig',
    'SvelteTransitionReturnType',
    'SvelteAnimationReturnType',
    'SvelteWithOptionalProps',
    'SvelteAllProps',
    'SveltePropsAnyFallback',
    'SvelteSlotsAnyFallback',
    'SvelteRestProps',
    'SvelteSlots',
    'SvelteStore'
]);

const startsWithUppercase = /^[A-Z]/;

function createIsValidCompletion(
    document: Document,
    position: Position,
    hasParserError: boolean
): (value: ts.CompletionEntry) => boolean {
    // Make fallback completions for tags inside the template a bit better
    const isAtStartTag =
        !isInTag(position, document.scriptInfo) &&
        /<\w*$/.test(
            document.getText(Range.create(position.line, 0, position.line, position.character))
        );
    const noWrongCompletionAtStartTag =
        isAtStartTag && hasParserError
            ? (value: ts.CompletionEntry) => startsWithUppercase.test(value.name)
            : () => true;

    const isNoSvelte2tsxCompletion = (value: ts.CompletionEntry) => {
        if (value.kindModifiers === 'declare') {
            return !value.name.startsWith('__sveltets_') && !svelte2tsxTypes.has(value.name);
        }

        return !value.name.startsWith('$$_');
    };
    const isCompletionInHTMLStartTag = !!getNodeIfIsInHTMLStartTag(
        document.html,
        document.offsetAt(position)
    );
    if (!isCompletionInHTMLStartTag) {
        return isNoSvelte2tsxCompletion;
    }
    // TODO with the new transformation this is ts.ScriptElementKind.memberVariableElement
    // which is also true for all properties of any other object -> how reliably filter this out?
    // ---> another /*ignore*/ pragma?
    // ---> OR: make these lower priority if we find out they are inside a html start tag
    return (value) => isNoSvelte2tsxCompletion(value) && noWrongCompletionAtStartTag(value);
}
