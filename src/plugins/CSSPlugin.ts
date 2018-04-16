import { getCSSLanguageService, Stylesheet } from 'vscode-css-languageservice';
import { Host, Document, HoverProvider, Position, Hover, Fragment } from '../api';

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
        if (!css) {
            return null;
        }

        if (!css.fragment.isInFragment(position)) {
            return null;
        }

        return this.lang.doHover(
            css.fragment,
            css.fragment.positionInFragment(position),
            css.stylesheet,
        );
    }
}
