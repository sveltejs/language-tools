import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import {
    CompletionList,
    Hover,
    Position,
    SymbolInformation,
    CompletionItem,
} from 'vscode-languageserver';
import { DocumentManager, Document, isInTag } from '../../lib/documents';
import { LSConfigManager, LSHTMLConfig } from '../../ls-config';
import { svelteHtmlDataProvider } from './dataProvider';
import { HoverProvider, CompletionsProvider } from '../interfaces';

export class HTMLPlugin implements HoverProvider, CompletionsProvider {
    private configManager: LSConfigManager;
    private lang = getLanguageService({ customDataProviders: [svelteHtmlDataProvider] });
    private documents = new WeakMap<Document, HTMLDocument>();

    constructor(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
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

        return this.lang.doHover(document, position, html);
    }

    getCompletions(document: Document, position: Position): CompletionList | null {
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

        const emmetResults: CompletionList = {
            isIncomplete: true,
            items: [],
        };
        this.lang.setCompletionParticipants([
            getEmmetCompletionParticipants(document, position, 'html', {}, emmetResults),
        ]);
        const results = this.isInComponentTag(html, document, position)
            ? // Only allow emmet inside component element tags.
              // Other attributes/events would be false positives.
              CompletionList.create([])
            : this.lang.doComplete(document, position, html);
        return CompletionList.create(
            [...results.items, ...this.getLangCompletions(results.items), ...emmetResults.items],
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0,
        );
    }

    private isInComponentTag(html: HTMLDocument, document: Document, position: Position) {
        const offset = document.offsetAt(position);
        const node = html.findNodeAt(offset);
        return !!node.tag && node.tag[0] === node.tag[0].toUpperCase();
    }

    private getLangCompletions(completions: CompletionItem[]): CompletionItem[] {
        const styleScriptTemplateCompletions = completions.filter((completion) =>
            ['template', 'style', 'script'].includes(completion.label),
        );
        const langCompletions: CompletionItem[] = [];
        addLangCompletion('script', ['ts']);
        addLangCompletion('style', ['less', 'scss']);
        addLangCompletion('template', ['pug']);
        return langCompletions;

        function addLangCompletion(tag: string, languages: string[]) {
            const existingCompletion = styleScriptTemplateCompletions.find(
                (completion) => completion.label === tag,
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
                    textEdit: existingCompletion.textEdit && {
                        range: existingCompletion.textEdit.range,
                        newText: `${existingCompletion.textEdit.newText} lang="${lang}"`,
                    },
                }),
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
        const charactersInNode = document.getText().substring(node.start, offset);
        return charactersInNode.lastIndexOf('{') > charactersInNode.lastIndexOf('}');
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

    private featureEnabled(feature: keyof LSHTMLConfig) {
        return (
            this.configManager.enabled('html.enable') &&
            this.configManager.enabled(`html.${feature}.enable`)
        );
    }
}
