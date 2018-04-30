import {
    getCSSLanguageService,
    Stylesheet,
    getSCSSLanguageService,
    getLESSLanguageService,
    LanguageService,
} from 'vscode-css-languageservice';
import * as prettier from 'prettier';
import detectIndent from 'detect-indent';
import indentString from 'indent-string';
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
    TextEdit,
    Range,
    FormattingProvider,
} from '../api';

export class CSSPlugin
    implements HoverProvider, CompletionsProvider, DiagnosticsProvider, FormattingProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'style';
    }

    private stylesheets = new WeakMap<Document, Stylesheet>();

    onRegister(host: Host) {
        host.on('documentChange', document =>
            this.stylesheets.set(
                document,
                getLanguageService(document.getAttributes().type).parseStylesheet(document),
            ),
        );
        host.on('documentClose', document => this.stylesheets.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return getLanguageService(document.getAttributes().type)
            .doValidation(document, stylesheet)
            .map(diagnostic => ({ ...diagnostic, source: 'css' }));
    }

    doHover(document: Document, position: Position): Hover | null {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return null;
        }

        return getLanguageService(document.getAttributes().type).doHover(
            document,
            position,
            stylesheet,
        );
    }

    getCompletions(document: Document, position: Position): CompletionItem[] {
        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        const completion = getLanguageService(document.getAttributes().type).doComplete(
            document,
            position,
            stylesheet,
        );
        if (!completion) {
            return [];
        }

        return completion.items;
    }

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (document.getTextLength() === 0) {
            return [];
        }

        const config = await prettier.resolveConfig(document.getFilePath()!);
        const formattedCode = prettier.format(document.getText(), {
            ...config,
            parser: getLanguage(document.getAttributes().type),
        });

        let indent = detectIndent(document.getText());
        return [
            TextEdit.replace(
                Range.create(document.positionAt(0), document.positionAt(document.getTextLength())),
                '\n' +
                    indentString(formattedCode, indent.amount, indent.type == 'tab' ? '\t' : ' '),
            ),
        ];
    }
}

const langs = {
    css: getCSSLanguageService(),
    scss: getSCSSLanguageService(),
    less: getLESSLanguageService(),
};

function getLanguage(kind?: string) {
    switch (kind) {
        case 'text/scss':
            return 'scss';
        case 'text/less':
            return 'less';
        case 'text/css':
        default:
            return 'css';
    }
}

function getLanguageService(kind?: string): LanguageService {
    const lang = getLanguage(kind);
    return langs[lang];
}
