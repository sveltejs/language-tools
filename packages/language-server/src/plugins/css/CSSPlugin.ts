import { getEmmetCompletionParticipants } from 'vscode-emmet-helper';
import {
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionContext,
    CompletionList,
    CompletionTriggerKind,
    Diagnostic,
    Hover,
    Position,
    Range,
    SymbolInformation,
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    mapColorInformationToOriginal,
    mapColorPresentationToOriginal,
    mapCompletionItemToOriginal,
    mapDiagnosticToOriginal,
    mapHoverToParent,
    mapRangeToGenerated,
    mapSymbolInformationToOriginal,
} from '../../lib/documents';
import { LSConfigManager, LSCSSConfig } from '../../ls-config';
import {
    ColorPresentationsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    DocumentSymbolsProvider,
    HoverProvider,
    OnRegister,
} from '../interfaces';
import { CSSDocument } from './CSSDocument';
import { getLanguage, getLanguageService } from './service';

export class CSSPlugin
    implements
        OnRegister,
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider {
    private configManager!: LSConfigManager;
    private cssDocuments = new WeakMap<Document, CSSDocument>();
    private triggerCharacters = ['.', ':', '-', '/'];

    onRegister(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;
        docManager.on('documentChange', (document) =>
            this.cssDocuments.set(document, new CSSDocument(document)),
        );
        docManager.on('documentClose', (document) => this.cssDocuments.delete(document));
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);
        const kind = extractLanguage(cssDocument);

        if (shouldExcludeValidation(kind)) {
            return [];
        }

        return getLanguageService(kind)
            .doValidation(cssDocument, cssDocument.stylesheet)
            .map((diagnostic) => ({ ...diagnostic, source: getLanguage(kind) }))
            .map((diagnostic) => mapDiagnosticToOriginal(cssDocument, diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);
        if (!cssDocument.isInGenerated(position)) {
            return null;
        }

        const hoverInfo = getLanguageService(extractLanguage(cssDocument)).doHover(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet,
        );
        return hoverInfo ? mapHoverToParent(cssDocument, hoverInfo) : hoverInfo;
    }

    getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext,
    ): CompletionList | null {
        const triggerCharacter = completionContext?.triggerCharacter;
        const triggerKind = completionContext?.triggerKind;
        const isCustomTriggerCharater = triggerKind === CompletionTriggerKind.TriggerCharacter;

        if (
            isCustomTriggerCharater &&
            triggerCharacter &&
            !this.triggerCharacters.includes(triggerCharacter)
        ) {
            return null;
        }

        if (!this.featureEnabled('completions')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);
        if (!cssDocument.isInGenerated(position)) {
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
                cssDocument.getGeneratedPosition(position),
                getLanguage(type),
                {},
                emmetResults,
            ),
        ]);
        const results = lang.doComplete(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet,
        );
        return CompletionList.create(
            [...(results ? results.items : []), ...emmetResults.items].map((completionItem) =>
                mapCompletionItemToOriginal(cssDocument, completionItem),
            ),
            true,
        );
    }

    getDocumentColors(document: Document): ColorInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        return getLanguageService(extractLanguage(cssDocument))
            .findDocumentColors(cssDocument, cssDocument.stylesheet)
            .map((colorInfo) => mapColorInformationToOriginal(cssDocument, colorInfo));
    }

    getColorPresentations(document: Document, range: Range, color: Color): ColorPresentation[] {
        if (!this.featureEnabled('colorPresentations')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);
        if (!cssDocument.isInGenerated(range.start) && !cssDocument.isInGenerated(range.end)) {
            return [];
        }

        return getLanguageService(extractLanguage(cssDocument))
            .getColorPresentations(
                cssDocument,
                cssDocument.stylesheet,
                color,
                mapRangeToGenerated(cssDocument, range),
            )
            .map((colorPres) => mapColorPresentationToOriginal(cssDocument, colorPres));
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        return getLanguageService(extractLanguage(cssDocument))
            .findDocumentSymbols(cssDocument, cssDocument.stylesheet)
            .map((symbol) => {
                if (!symbol.containerName) {
                    return {
                        ...symbol,
                        // TODO: this could contain other things, e.g. style.myclass
                        containerName: 'style',
                    };
                }

                return symbol;
            })
            .map((symbol) => mapSymbolInformationToOriginal(cssDocument, symbol));
    }

    private getCSSDoc(document: Document) {
        let cssDoc = this.cssDocuments.get(document);
        if (!cssDoc || cssDoc.version < document.version) {
            cssDoc = new CSSDocument(document);
            this.cssDocuments.set(document, cssDoc);
        }
        return cssDoc;
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
