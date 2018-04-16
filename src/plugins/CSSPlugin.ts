import { getCSSLanguageService, Stylesheet } from 'vscode-css-languageservice';
import {
    Host,
    Document,
    HoverProvider,
    Position,
    Hover,
    CompletionItem,
    CompletionsProvider,
    Fragment,
    DiagnosticsProvider,
    Diagnostic,
} from '../api';

export class CSSPlugin implements HoverProvider, CompletionsProvider, DiagnosticsProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'style';
    }

    private lang = getCSSLanguageService(); // Support css, less, and scss
    private stylesheets = new WeakMap<Document, Stylesheet>();

    onRegister(host: Host) {
        host.on('documentChange', document =>
            this.stylesheets.set(document, this.lang.parseStylesheet(document)),
        );
        host.on('documentClose', document => this.stylesheets.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return this.lang
            .doValidation(document, stylesheet)
            .map(diagnostic => ({ ...diagnostic, source: 'css' }));
    }

    doHover(document: Document, position: Position): Hover | null {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return null;
        }

        return this.lang.doHover(document, position, stylesheet);
    }

    getCompletions(document: Document, position: Position): CompletionItem[] {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        const completion = this.lang.doComplete(document, position, stylesheet);
        if (!completion) {
            return [];
        }

        return completion.items;
    }
}
