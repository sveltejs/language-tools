import {
    getLanguageService,
    HTMLDocument,
    HTMLFormatConfiguration,
} from 'vscode-html-languageservice';
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
    FormattingProvider,
    TextEdit,
    Range,
    SymbolInformation,
} from '../api';

export class HTMLPlugin implements HoverProvider, CompletionsProvider, FormattingProvider {
    public pluginId = 'html';
    public defaultConfig = {
        enable: true,
        hover: { enable: true },
        completions: { enable: true },
        tagComplete: { enable: true },
        format: { enable: true },
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

    getCompletions(document: Document, position: Position): CompletionItem[] {
        if (!this.host.getConfig<boolean>('html.completions.enable')) {
            return [];
        }

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
        if (!this.host.getConfig<boolean>('html.tagComplete.enable')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doTagComplete(document, position, html);
    }

    formatDocument(document: Document): TextEdit[] {
        if (!this.host.getConfig<boolean>('html.format.enable')) {
            return [];
        }

        const html = this.documents.get(document);
        if (!html) {
            return [];
        }

        const style = html.roots.find(node => node.tag === 'style');
        const script = html.roots.find(node => node.tag === 'script');

        let rangeEnd = document.getTextLength();
        if (style && style.start < rangeEnd) {
            rangeEnd = style.start + 1;
        }
        if (script && script.start < rangeEnd) {
            rangeEnd = script.start + 1;
        }

        const range = Range.create(document.positionAt(0), document.positionAt(rangeEnd));

        const settings = this.host.getConfig<HTMLFormatConfiguration>('html.format.settings') || {};
        return this.lang.format(document, range, settings);
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
