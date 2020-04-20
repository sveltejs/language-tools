import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import {
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionList,
    Diagnostic,
    Hover,
    Position,
    Range,
    SymbolInformation,
} from 'vscode-languageserver';
import {
    DocumentManager,
    Document,
    mapDiagnosticToParent,
    mapHoverToParent,
    mapCompletionItemToParent,
    mapColorInformationToParent,
    mapRangeToFragment,
    mapColorPresentationToParent,
    mapSymbolInformationToParent,
} from '../../lib/documents';
import { LSConfigManager, LSCSSConfig } from '../../ls-config';
import { CSSDocument } from './CSSDocument';
import { getLanguage, getLanguageService } from './service';
import {
    OnRegister,
    HoverProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    ColorPresentationsProvider,
    DocumentSymbolsProvider,
} from '../interfaces';

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

    private configManager!: LSConfigManager;
    private cssDocuments = new WeakMap<Document, CSSDocument>();

    onRegister(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        docManager.on('documentChange', document =>
            this.cssDocuments.set(document, new CSSDocument(document)),
        );
        docManager.on('documentClose', document => this.cssDocuments.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const cssDocument = this.cssDocuments.get(document);
        if (!cssDocument) {
            return [];
        }

        const kind = extractLanguage(cssDocument);

        if (shouldExcludeValidation(kind)) {
            return [];
        }

        return getLanguageService(kind)
            .doValidation(cssDocument, cssDocument.stylesheet)
            .map(diagnostic => ({ ...diagnostic, source: getLanguage(kind) }))
            .map(diagnostic => mapDiagnosticToParent(cssDocument, diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const cssDocument = this.cssDocuments.get(document);
        if (!cssDocument || !cssDocument.isInFragment(position)) {
            return null;
        }

        const hoverInfo = getLanguageService(extractLanguage(cssDocument)).doHover(
            cssDocument,
            cssDocument.positionInFragment(position),
            cssDocument.stylesheet,
        );
        return hoverInfo ? mapHoverToParent(cssDocument, hoverInfo) : hoverInfo;
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

        const cssDocument = this.cssDocuments.get(document);
        if (!cssDocument || !cssDocument.isInFragment(position)) {
            return null;
        }

        const type = extractLanguage(cssDocument);
        const lang = getLanguageService(type);
        const emmetResults: CompletionList = {
            isIncomplete: true,
            items: [],
        };
        lang.setCompletionParticipants([
            getEmmetCompletionParticipants(
                cssDocument,
                cssDocument.positionInFragment(position),
                getLanguage(type),
                {},
                emmetResults,
            ),
        ]);
        const results = lang.doComplete(
            cssDocument,
            cssDocument.positionInFragment(position),
            cssDocument.stylesheet,
        );
        return CompletionList.create(
            [...(results ? results.items : []), ...emmetResults.items].map(completionItem =>
                mapCompletionItemToParent(cssDocument, completionItem),
            ),
            true,
        );
    }

    getDocumentColors(document: Document): ColorInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.cssDocuments.get(document);
        if (!cssDocument) {
            return [];
        }

        return getLanguageService(extractLanguage(cssDocument))
            .findDocumentColors(cssDocument, cssDocument.stylesheet)
            .map(colorInfo => mapColorInformationToParent(cssDocument, colorInfo));
    }

    getColorPresentations(document: Document, range: Range, color: Color): ColorPresentation[] {
        if (!this.featureEnabled('colorPresentations')) {
            return [];
        }

        const cssDocument = this.cssDocuments.get(document);
        if (
            !cssDocument ||
            (!cssDocument.isInFragment(range.start) && !cssDocument.isInFragment(range.end))
        ) {
            return [];
        }

        return getLanguageService(extractLanguage(cssDocument))
            .getColorPresentations(
                cssDocument,
                cssDocument.stylesheet,
                color,
                mapRangeToFragment(cssDocument, range),
            )
            .map(colorPres => mapColorPresentationToParent(cssDocument, colorPres));
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.cssDocuments.get(document);
        if (!cssDocument) {
            return [];
        }

        return getLanguageService(extractLanguage(cssDocument))
            .findDocumentSymbols(cssDocument, cssDocument.stylesheet)
            .map(symbol => {
                if (!symbol.containerName) {
                    return {
                        ...symbol,
                        // TODO: this could contain other things, e.g. style.myclass
                        containerName: 'style',
                    };
                }

                return symbol;
            })
            .map(symbol => mapSymbolInformationToParent(cssDocument, symbol));
    }

    private featureEnabled(feature: keyof LSCSSConfig) {
        return (
            this.configManager.enabled('css.enable') &&
            this.configManager.enabled(`css.${feature}.enable`)
        );
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

function extractLanguage(document: CSSDocument): string {
    const attrs = document.getAttributes();
    return attrs.lang || attrs.type;
}
