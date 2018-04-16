import { getCSSLanguageService, Stylesheet } from 'vscode-css-languageservice';
import { Host, Document, HoverProvider, Position, Hover, Fragment, CompletionItem } from '../api';
import { mapCompletionItemToParent } from '../api/fragmentPositions';

export class CSSPlugin implements HoverProvider {
    private lang = getCSSLanguageService(); // Support css, less, and scss
    private stylesheets = new WeakMap<Document, { stylesheet: Stylesheet; fragment: Fragment }>();

    onRegister(host: Host) {
        host.on('documentChange|pre', document => {
            const fragment = document.findFragment(
                fragment => fragment.details.attributes.tag == 'style',
            );
            if (!fragment) {
                this.stylesheets.delete(document);
                return;
            }

            const stylesheet = this.lang.parseStylesheet(fragment);
            this.stylesheets.set(document, { stylesheet, fragment });
        });
    }

    doHover(document: Document, position: Position): Hover | null {
        const css = this.stylesheets.get(document);
        if (!css || !css.fragment.isInFragment(position)) {
            return null;
        }

        return this.lang.doHover(
            css.fragment,
            css.fragment.positionInFragment(position),
            css.stylesheet,
        );
    }

    getCompletions(document: Document, position: Position): CompletionItem[] {
        const css = this.stylesheets.get(document);
        if (!css || !css.fragment.isInFragment(position)) {
            return [];
        }

        const completion = this.lang.doComplete(
            css.fragment,
            css.fragment.positionInFragment(position),
            css.stylesheet,
        );
        if (!completion) {
            return [];
        }

        return completion.items.map(item => mapCompletionItemToParent(css.fragment, item));
    }
}
