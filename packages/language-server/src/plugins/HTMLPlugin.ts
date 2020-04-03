import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import {
    CompletionList,
    CompletionsProvider,
    Document,
    Host,
    Hover,
    HoverProvider,
    Position,
    SymbolInformation,
} from '../api';
import { svelteHtmlDataProvider } from './html/dataProvider';
import { LSHTMLConfig } from '../ls-config';
// import { svelteHtmlDataProvider } from './html/dataProvider';

export class HTMLPlugin implements HoverProvider, CompletionsProvider {
    private host!: Host;
    private lang = getLanguageService({ customDataProviders: [svelteHtmlDataProvider] });
    private documents = new WeakMap<Document, HTMLDocument>();

    onRegister(host: Host) {
        this.host = host;
        host.on('documentChange|pre', document => {
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

        return this.lang.doTagComplete(document, position, html);
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
            this.host.getConfig<boolean>('html.enable') &&
            this.host.getConfig<boolean>(`html.${feature}.enable`)
        );
    }
}
