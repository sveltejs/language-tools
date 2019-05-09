import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import {
    Host,
    Document,
    HoverProvider,
    Position,
    Hover,
    CompletionsProvider,
    CompletionItem,
    CompletionList,
    SymbolInformation,
} from '../api';

export class HTMLPlugin implements HoverProvider, CompletionsProvider {
    public pluginId = 'html';
    public defaultConfig = {
        enable: true,
        hover: { enable: true },
        completions: { enable: true },
        tagComplete: { enable: true },
        documentSymbols: { enable: true },
    };

    private host!: Host;
    private lang = getLanguageService();
    private documents = new WeakMap<Document, HTMLDocument>();

    onRegister(host: Host) {
        this.host = host;
        host.on('documentChange|pre', document => {
            const html = this.lang.parseHTMLDocument(document);
            this.documents.set(document, html);
        });
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.host.getConfig<boolean>('html.hover.enable')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doHover(document, position, html);
    }

    getCompletions(document: Document, position: Position): CompletionList | null {
        if (!this.host.getConfig<boolean>('html.completions.enable')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
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
        if (!this.host.getConfig<boolean>('html.tagComplete.enable')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doTagComplete(document, position, html);
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.host.getConfig<boolean>('html.documentSymbols.enable')) {
            return [];
        }

        const html = this.documents.get(document);
        if (!html) {
            return [];
        }

        return this.lang.findDocumentSymbols(document, html);
    }
}
