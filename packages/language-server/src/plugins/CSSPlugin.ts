import {
    getCSSLanguageService,
    Stylesheet,
    getSCSSLanguageService,
    getLESSLanguageService,
    LanguageService,
} from 'vscode-css-languageservice';
import {
    Document,
    Position,
    Hover,
    Fragment,
    Diagnostic,
    Range,
    CompletionList,
    ColorInformation,
    Color,
    ColorPresentation,
    SymbolInformation,
    HoverProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    ColorPresentationsProvider,
    DocumentSymbolsProvider,
    OnRegister,
} from '../api';
import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import { LSCSSConfig, LSConfigManager } from '../ls-config';
import { DocumentManager } from '../lib/documents/DocumentManager';

export class CSSPlugin
    implements
        OnRegister,
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider {
    private readonly triggerCharacters = ['/'];

    public static matchFragment(fragment: Fragment) {
        return fragment.details.attributes.tag == 'style';
    }

    private configManager!: LSConfigManager;
    private stylesheets = new WeakMap<Document, Stylesheet>();

    onRegister(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        docManager.on('documentChange', document =>
            this.stylesheets.set(
                document,
                getLanguageService(extractLanguage(document)).parseStylesheet(document),
            ),
        );
        docManager.on('documentClose', document => this.stylesheets.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const stylesheet = this.stylesheets.get(document);
        if (!stylesheet) {
            return [];
        }

        const kind = extractLanguage(document);

        if (shouldExcludeValidation(kind)) {
            return [];
        }

        return getLanguageService(kind)
            .doValidation(document, stylesheet)
            .map(diagnostic => ({ ...diagnostic, source: getLanguage(kind) }));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
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

    getCompletions(
        document: Document,
        position: Position,
        triggerCharacter: string,
    ): CompletionList | null {
        // TODO: Why did this need to be removed?
        // if (triggerCharacter != undefined && !this.triggerCharacters.includes(triggerCharacter)) {
        //     return null;
        // }

        if (!this.featureEnabled('completions')) {
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
        if (!this.featureEnabled('documentColors')) {
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
        if (!this.featureEnabled('colorPresentations')) {
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
        if (!this.featureEnabled('documentColors')) {
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

    private featureEnabled(feature: keyof LSCSSConfig) {
        return (
            this.configManager.enabled('css.enable') &&
            this.configManager.enabled(`css.${feature}.enable`)
        );
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

function shouldExcludeValidation(kind?: string) {
    switch (kind) {
        case 'postcss':
        case 'text/postcss':
            return true;
        default:
            return false;
    }
}

function getLanguageService(kind?: string): LanguageService {
    const lang = getLanguage(kind);
    return langs[lang];
}
