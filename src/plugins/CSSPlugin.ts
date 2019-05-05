import {
    getCSSLanguageService,
    Stylesheet,
    getSCSSLanguageService,
    getLESSLanguageService,
    LanguageService,
} from 'vscode-css-languageservice';
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
    Range,
    CompletionList,
    DocumentColorsProvider,
    ColorInformation,
    ColorPresentationsProvider,
    Color,
    ColorPresentation,
    DocumentSymbolsProvider,
    SymbolInformation,
} from '../api';
import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';

export class CSSPlugin
    implements
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider {
    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'style';
    }

    public pluginId = 'css';
    public defaultConfig = {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        documentColors: { enable: true },
        colorPresentations: { enable: true },
        documentSymbols: { enable: true },
    };

    private host!: Host;
    private stylesheets = new WeakMap<Document, Stylesheet>();

    onRegister(host: Host) {
        this.host = host;
        host.on('documentChange', document =>
            this.stylesheets.set(
                document,
                getLanguageService(extractLanguage(document)).parseStylesheet(document),
            ),
        );
        host.on('documentClose', document => this.stylesheets.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.host.getConfig<boolean>('css.diagnostics.enable')) {
            return [];
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return getLanguageService(extractLanguage(document))
            .doValidation(document, stylesheet)
            .map(diagnostic => ({ ...diagnostic, source: 'css' }));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.host.getConfig<boolean>('css.hover.enable')) {
            return null;
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return null;
        }

        return getLanguageService(extractLanguage(document)).doHover(
            document,
            position,
            stylesheet,
        );
    }

    getCompletions(document: Document, position: Position): CompletionList | null {
        if (!this.host.getConfig<boolean>('css.completions.enable')) {
            return null;
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return null;
        }

        const type = extractLanguage(document);
        const lang = getLanguageService(type);
        const emmetResults: CompletionList = {
            isIncomplete: true,
            items: [],
        };
        lang.setCompletionParticipants([
            getEmmetCompletionParticipants(document, position, getLanguage(type), {}, emmetResults),
        ]);
        const results = lang.doComplete(document, position, stylesheet);
        return CompletionList.create(
            [...(results ? results.items : []), ...emmetResults.items],
            true,
        );
    }

    getDocumentColors(document: Document): ColorInformation[] {
        if (!this.host.getConfig<boolean>('css.documentColors.enable')) {
            return [];
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return getLanguageService(extractLanguage(document)).findDocumentColors(
            document,
            stylesheet,
        );
    }

    getColorPresentations(document: Document, range: Range, color: Color): ColorPresentation[] {
        if (!this.host.getConfig<boolean>('css.colorPresentations.enable')) {
            return [];
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return getLanguageService(extractLanguage(document)).getColorPresentations(
            document,
            stylesheet,
            color,
            range,
        );
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.host.getConfig<boolean>('css.documentColors.enable')) {
            return [];
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        return getLanguageService(extractLanguage(document))
            .findDocumentSymbols(document, stylesheet)
            .map(symbol => {
                if (!symbol.containerName) {
                    return {
                        ...symbol,
                        // TODO: this could contain other things, e.g. style.myclass
                        containerName: 'style',
                    };
                }

                return symbol;
            });
    }
}

const langs = {
    css: getCSSLanguageService(),
    scss: getSCSSLanguageService(),
    less: getLESSLanguageService(),
};

function extractLanguage(document: Document): string {
    const attrs = document.getAttributes();
    return attrs.lang || attrs.type;
}

function getLanguage(kind?: string) {
    switch (kind) {
        case 'scss':
        case 'text/scss':
            return 'scss';
        case 'less':
        case 'text/less':
            return 'less';
        case 'css':
        case 'text/css':
        default:
            return 'css';
    }
}

function getLanguageService(kind?: string): LanguageService {
    const lang = getLanguage(kind);
    return langs[lang];
}
