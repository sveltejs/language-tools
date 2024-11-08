import { doComplete as doEmmetComplete } from '@vscode/emmet-helper';
import {
    getLanguageService,
    HTMLDocument,
    CompletionItem as HtmlCompletionItem,
    Node,
    newHTMLDataProvider
} from 'vscode-html-languageservice';
import {
    CompletionList,
    Hover,
    Position,
    SymbolInformation,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    Range,
    WorkspaceEdit,
    LinkedEditingRanges,
    CompletionContext,
    FoldingRange
} from 'vscode-languageserver';
import {
    DocumentManager,
    Document,
    isInTag,
    getNodeIfIsInComponentStartTag
} from '../../lib/documents';
import { LSConfigManager, LSHTMLConfig } from '../../ls-config';
import { svelteHtmlDataProvider } from './dataProvider';
import {
    HoverProvider,
    CompletionsProvider,
    RenameProvider,
    LinkedEditingRangesProvider,
    FoldingRangeProvider
} from '../interfaces';
import { isInsideMoustacheTag, toRange } from '../../lib/documents/utils';
import { isNotNullOrUndefined, possiblyComponent } from '../../utils';
import { importPrettier } from '../../importPackage';
import path from 'path';
import { Logger } from '../../logger';
import { indentBasedFoldingRangeForTag } from '../../lib/foldingRange/indentFolding';

export class HTMLPlugin
    implements
        HoverProvider,
        CompletionsProvider,
        RenameProvider,
        LinkedEditingRangesProvider,
        FoldingRangeProvider
{
    __name = 'html';
    private lang = getLanguageService({
        customDataProviders: this.getCustomDataProviders(),
        useDefaultDataProvider: false,
        clientCapabilities: this.configManager.getClientCapabilities()
    });
    private documents = new WeakMap<Document, HTMLDocument>();
    private styleScriptTemplate = new Set(['template', 'style', 'script']);

    private htmlTriggerCharacters = ['.', ':', '<', '"', '=', '/'];

    constructor(
        docManager: DocumentManager,
        private configManager: LSConfigManager
    ) {
        configManager.onChange(() =>
            this.lang.setDataProviders(false, this.getCustomDataProviders())
        );
        docManager.on('documentChange', (document) => {
            this.documents.set(document, document.html);
        });
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const node = html.findNodeAt(document.offsetAt(position));
        if (!node || possiblyComponent(node)) {
            return null;
        }

        return this.lang.doHover(document, position, html);
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        if (
            this.isInsideMoustacheTag(html, document, position) ||
            isInTag(position, document.scriptInfo) ||
            isInTag(position, document.moduleScriptInfo)
        ) {
            return null;
        }

        let emmetResults: CompletionList = {
            isIncomplete: false,
            items: []
        };

        let doEmmetCompleteInner = (): CompletionList | null | undefined => null;
        if (
            this.configManager.getConfig().html.completions.emmet &&
            this.configManager.getEmmetConfig().showExpandedAbbreviation !== 'never'
        ) {
            doEmmetCompleteInner = () =>
                doEmmetComplete(document, position, 'html', this.configManager.getEmmetConfig());

            this.lang.setCompletionParticipants([
                {
                    onHtmlContent: () => (emmetResults = doEmmetCompleteInner() || emmetResults)
                }
            ]);
        }

        if (
            completionContext?.triggerCharacter &&
            !this.htmlTriggerCharacters.includes(completionContext?.triggerCharacter)
        ) {
            return doEmmetCompleteInner() ?? null;
        }

        const results = this.isInComponentTag(html, document, position)
            ? // Only allow emmet inside component element tags.
              // Other attributes/events would be false positives.
              CompletionList.create([])
            : this.lang.doComplete(document, position, html);
        const items = this.toCompletionItems(results.items);
        const filePath = document.getFilePath();

        const prettierConfig =
            filePath &&
            items.some((item) => item.label.startsWith('on:') || item.label.startsWith('bind:'))
                ? this.configManager.getMergedPrettierConfig(
                      await importPrettier(filePath).resolveConfig(filePath, {
                          editorconfig: true
                      })
                  )
                : null;

        const svelteStrictMode = prettierConfig?.svelteStrictMode;
        items.forEach((item) => {
            const startQuote = svelteStrictMode ? '"{' : '{';
            const endQuote = svelteStrictMode ? '}"' : '}';
            if (!item.textEdit) {
                return;
            }

            if (item.label.startsWith('on:')) {
                item.textEdit = {
                    ...item.textEdit,
                    newText: item.textEdit.newText.replace('="$1"', `$2=${startQuote}$1${endQuote}`)
                };
            }

            if (item.label.startsWith('bind:')) {
                item.textEdit = {
                    ...item.textEdit,
                    newText: item.textEdit.newText.replace('="$1"', `=${startQuote}$1${endQuote}`)
                };
            }
        });

        return CompletionList.create(
            [
                ...this.toCompletionItems(items),
                ...this.getLangCompletions(items),
                ...emmetResults.items
            ],
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0
        );
    }

    /**
     * The HTML language service uses newer types which clash
     * without the stable ones. Transform to the stable types.
     */
    private toCompletionItems(items: HtmlCompletionItem[]): CompletionItem[] {
        return items.map((item) => {
            if (!item.textEdit || TextEdit.is(item.textEdit)) {
                return <CompletionItem>item;
            }
            return {
                ...item,
                textEdit: TextEdit.replace(item.textEdit.replace, item.textEdit.newText)
            };
        });
    }

    private isInComponentTag(html: HTMLDocument, document: Document, position: Position) {
        return !!getNodeIfIsInComponentStartTag(html, document.offsetAt(position));
    }

    private getLangCompletions(completions: CompletionItem[]): CompletionItem[] {
        const styleScriptTemplateCompletions = completions.filter(
            (completion) =>
                completion.kind === CompletionItemKind.Property &&
                this.styleScriptTemplate.has(completion.label)
        );
        const langCompletions: CompletionItem[] = [];
        addLangCompletion('script', ['ts']);
        addLangCompletion('style', ['less', 'scss']);
        addLangCompletion('template', ['pug']);
        return langCompletions;

        function addLangCompletion(tag: string, languages: string[]) {
            const existingCompletion = styleScriptTemplateCompletions.find(
                (completion) => completion.label === tag
            );
            if (!existingCompletion) {
                return;
            }

            languages.forEach((lang) =>
                langCompletions.push({
                    ...existingCompletion,
                    label: `${tag} (lang="${lang}")`,
                    insertText:
                        existingCompletion.insertText &&
                        `${existingCompletion.insertText} lang="${lang}"`,
                    textEdit:
                        existingCompletion.textEdit && TextEdit.is(existingCompletion.textEdit)
                            ? {
                                  range: existingCompletion.textEdit.range,
                                  newText: `${existingCompletion.textEdit.newText} lang="${lang}"`
                              }
                            : undefined
                })
            );
        }
    }

    doTagComplete(document: Document, position: Position): string | null {
        if (!this.featureEnabled('tagComplete')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        if (this.isInsideMoustacheTag(html, document, position)) {
            return null;
        }

        return this.lang.doTagComplete(document, position, html);
    }

    private isInsideMoustacheTag(html: HTMLDocument, document: Document, position: Position) {
        const offset = document.offsetAt(position);
        const node = html.findNodeAt(offset);
        return isInsideMoustacheTag(document.getText(), node.start, offset);
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }

        const html = this.documents.get(document);
        if (!html) {
            return [];
        }

        return this.lang.findDocumentSymbols(document, html);
    }

    rename(document: Document, position: Position, newName: string): WorkspaceEdit | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const node = html.findNodeAt(document.offsetAt(position));
        if (!node || possiblyComponent(node)) {
            return null;
        }

        return this.lang.doRename(document, position, newName, html);
    }

    prepareRename(document: Document, position: Position): Range | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const offset = document.offsetAt(position);
        const node = html.findNodeAt(offset);
        if (!node || possiblyComponent(node) || !node.tag || !this.isRenameAtTag(node, offset)) {
            return null;
        }
        const tagNameStart = node.start + '<'.length;

        return toRange(document, tagNameStart, tagNameStart + node.tag.length);
    }

    getLinkedEditingRanges(document: Document, position: Position): LinkedEditingRanges | null {
        if (!this.featureEnabled('linkedEditing')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const ranges = this.lang.findLinkedEditingRanges(document, position, html);

        if (!ranges) {
            return null;
        }

        // Note that `.` is excluded from the word pattern. This is intentional to support property access in Svelte component tags.
        return {
            ranges,
            wordPattern:
                '(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\\'\\"\\,\\<\\>\\/\\s]+)'
        };
    }

    getFoldingRanges(document: Document): FoldingRange[] {
        const result = this.lang.getFoldingRanges(document);
        const templateRange = document.templateInfo
            ? indentBasedFoldingRangeForTag(document, document.templateInfo)
            : [];

        const ARROW = '=>';

        if (!document.getText().includes(ARROW)) {
            return result.concat(templateRange);
        }

        const byEnd = new Map<number, FoldingRange[]>();
        for (const fold of result) {
            byEnd.set(fold.endLine, (byEnd.get(fold.endLine) ?? []).concat(fold));
        }

        let startIndex = 0;
        while (startIndex < document.getTextLength()) {
            const index = document.getText().indexOf(ARROW, startIndex);
            startIndex = index + ARROW.length;

            if (index === -1) {
                break;
            }
            const position = document.positionAt(index);
            const isInStyleOrScript =
                isInTag(position, document.styleInfo) ||
                isInTag(position, document.scriptInfo) ||
                isInTag(position, document.moduleScriptInfo);

            if (isInStyleOrScript) {
                continue;
            }

            const tag = document.html.findNodeAt(index);

            // our version of html document patched it so it's within the start tag
            // but not the folding range returned by the language service
            // which uses unpatched scanner
            if (!tag.startTagEnd || index > tag.startTagEnd) {
                continue;
            }

            const tagStartPosition = document.positionAt(tag.start);
            const range = byEnd
                .get(position.line)
                ?.find((r) => r.startLine === tagStartPosition.line);

            const newEndLine = document.positionAt(tag.end).line - 1;
            if (newEndLine <= tagStartPosition.line) {
                continue;
            }

            if (range) {
                range.endLine = newEndLine;
            } else {
                result.push({
                    startLine: tagStartPosition.line,
                    endLine: newEndLine
                });
            }
        }

        return result.concat(templateRange);
    }

    /**
     * Returns true if rename happens at the tag name, not anywhere inbetween.
     */
    private isRenameAtTag(node: Node, offset: number): boolean {
        if (!node.tag) {
            return false;
        }

        const startTagNameEnd = node.start + `<${node.tag}`.length;
        const isAtStartTag = offset > node.start && offset <= startTagNameEnd;
        const isAtEndTag =
            node.endTagStart !== undefined && offset >= node.endTagStart && offset < node.end;
        return isAtStartTag || isAtEndTag;
    }

    private getCustomDataProviders() {
        const providers =
            this.configManager
                .getHTMLConfig()
                ?.customData?.map((customDataPath) => {
                    try {
                        const jsonPath = path.resolve(customDataPath);
                        return newHTMLDataProvider(customDataPath, require(jsonPath));
                    } catch (error) {
                        Logger.error(error);
                    }
                })
                .filter(isNotNullOrUndefined) ?? [];

        return [svelteHtmlDataProvider].concat(providers);
    }

    private featureEnabled(feature: keyof LSHTMLConfig) {
        return (
            this.configManager.enabled('html.enable') &&
            this.configManager.enabled(`html.${feature}.enable`)
        );
    }
}
