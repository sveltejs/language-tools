import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import {
    Host,
    Document,
    HoverProvider,
    Position,
    Hover,
    CompletionsProvider,
    CompletionItem,
} from '../api';

export class HTMLPlugin implements HoverProvider, CompletionsProvider {
    private lang = getLanguageService();
    private documents = new WeakMap<Document, HTMLDocument>();

    onRegister(host: Host) {
        host.on('documentChange|pre', document => {
            const html = this.lang.parseHTMLDocument(document);
            this.documents.set(document, html);
        });
    }

    doHover(document: Document, position: Position): Hover | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doHover(document, position, html);
    }

    getCompletions(document: Document, position: Position): CompletionItem[] {
        const html = this.documents.get(document);
        if (!html) {
            return [];
        }

        return this.lang.doComplete(document, position, html).items;
    }
}
