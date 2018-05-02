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

        const emmetResults: CompletionList = {
            isIncomplete: true,
            items: [],
        };
        this.lang.setCompletionParticipants([
            getEmmetCompletionParticipants(document, position, 'html', {}, emmetResults),
        ]);
        const results = this.lang.doComplete(document, position, html);
        return [...results.items, ...emmetResults.items];
    }

    doTagComplete(document: Document, position: Position): string | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doTagComplete(document, position, html);
    }
}
