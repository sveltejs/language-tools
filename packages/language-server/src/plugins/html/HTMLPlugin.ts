import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import { CompletionList, Hover, Position, SymbolInformation } from 'vscode-languageserver';
import { DocumentManager, Document } from '../../lib/documents';
import { LSConfigManager, LSHTMLConfig } from '../../ls-config';
import { svelteHtmlDataProvider } from './dataProvider';
import { OnRegister, HoverProvider, CompletionsProvider } from '../interfaces';
// import { svelteHtmlDataProvider } from './html/dataProvider';

export class HTMLPlugin implements OnRegister, HoverProvider, CompletionsProvider {
    private configManager!: LSConfigManager;
    private lang = getLanguageService({ customDataProviders: [svelteHtmlDataProvider] });
    private documents = new WeakMap<Document, HTMLDocument>();

    onRegister(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        docManager.on('documentChange', (document) => {
            const html = this.lang.parseHTMLDocument(document);
            this.documents.set(document, html);
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

        if (this.isInsideMoustacheTag(html, document, position)) {
            return null;
        }

        const emmetResults: CompletionList = {
            isIncomplete: true,
            items: [],
        };
        this.lang.setCompletionParticipants([
            getEmmetCompletionParticipants(document, position, 'html', {}, emmetResults),
        ]);
        const results = this.lang.doComplete(document, position, html);
        return CompletionList.create([...results.items, ...emmetResults.items], true);
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
