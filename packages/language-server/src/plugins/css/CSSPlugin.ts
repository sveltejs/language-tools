import { getEmmetCompletionParticipants, doComplete as doEmmetComplete } from 'vscode-emmet-helper';
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
    CompletionItem,
    CompletionItemKind,
    SelectionRange
} from 'vscode-languageserver';
import {
    Document,
    DocumentManager,
    mapColorPresentationToOriginal,
    mapCompletionItemToOriginal,
    mapRangeToGenerated,
    mapSymbolInformationToOriginal,
    mapObjWithRangeToOriginal,
    mapHoverToParent,
    mapSelectionRangeToParent
} from '../../lib/documents';
import { LSConfigManager, LSCSSConfig } from '../../ls-config';
import {
    ColorPresentationsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    DocumentSymbolsProvider,
    HoverProvider,
    SelectionRangeProvider,
} from '../interfaces';
import { CSSDocument } from './CSSDocument';
import { getLanguage, getLanguageService } from './service';
import { GlobalVars } from './global-vars';

export class CSSPlugin
    implements
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider,
        SelectionRangeProvider {
    private configManager: LSConfigManager;
    private cssDocuments = new WeakMap<Document, CSSDocument>();
    private triggerCharacters = ['.', ':', '-', '/'];
    private globalVars = new GlobalVars();

    constructor(docManager: DocumentManager, configManager: LSConfigManager) {
        this.configManager = configManager;

        this.globalVars.watchFiles(this.configManager.get('css.globals'));
        this.configManager.onChange((config) =>
            this.globalVars.watchFiles(config.get('css.globals')),
        );

        docManager.on('documentChange', (document) =>
            this.cssDocuments.set(document, new CSSDocument(document)),
        );
        docManager.on('documentClose', (document) => this.cssDocuments.delete(document));
    }
    getSelectionRange(document: Document, position: Position): SelectionRange | null {
        const cssDocument = this.getCSSDoc(document);

        const [range] = getLanguageService(extractLanguage(cssDocument))
            .getSelectionRanges(
                cssDocument,
                [cssDocument.getGeneratedPosition(position)],
                cssDocument.stylesheet
            );

        if (!range) {
            return null;
        }

        return mapSelectionRangeToParent(cssDocument, range);
    }

    getDiagnostics(document: Document): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        if (isSASS(cssDocument)) {
            return [];
        }

        const kind = extractLanguage(cssDocument);

        if (shouldExcludeValidation(kind)) {
            return [];
        }

        return getLanguageService(kind)
            .doValidation(cssDocument, cssDocument.stylesheet)
            .map((diagnostic) => ({ ...diagnostic, source: getLanguage(kind) }))
            .map((diagnostic) => mapObjWithRangeToOriginal(cssDocument, diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);
        if (!cssDocument.isInGenerated(position) || isSASS(cssDocument)) {
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

        if (isSASS(cssDocument)) {
            // the css language service does not support sass, still we can use
            // the emmet helper directly to at least get emmet completions
            return doEmmetComplete(document, position, 'sass', {});
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
            this.appendGlobalVars(
                [...(results ? results.items : []), ...emmetResults.items].map((completionItem) =>
                    mapCompletionItemToOriginal(cssDocument, completionItem),
                ),
            ),
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0,
        );
    }

    private appendGlobalVars(items: CompletionItem[]): CompletionItem[] {
        // Finding one value with that item kind means we are in a value completion scenario
        const value = items.find((item) => item.kind === CompletionItemKind.Value);
        if (!value) {
            return items;
        }

        const additionalItems: CompletionItem[] = this.globalVars
            .getGlobalVars()
            .map((globalVar) => ({
                label: globalVar.name,
                detail: `${globalVar.filename}\n\n${globalVar.name}: ${globalVar.value}`,
                textEdit: value.textEdit && {
                    ...value.textEdit,
                    newText: `var(${globalVar.name})`,
                },
                kind: CompletionItemKind.Value,
            }));
        return [...items, ...additionalItems];
    }

    getDocumentColors(document: Document): ColorInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        if (isSASS(cssDocument)) {
            return [];
        }

        return getLanguageService(extractLanguage(cssDocument))
            .findDocumentColors(cssDocument, cssDocument.stylesheet)
            .map((colorInfo) => mapObjWithRangeToOriginal(cssDocument, colorInfo));
    }

    getColorPresentations(document: Document, range: Range, color: Color): ColorPresentation[] {
        if (!this.featureEnabled('colorPresentations')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);
        if (
            (!cssDocument.isInGenerated(range.start) && !cssDocument.isInGenerated(range.end)) ||
            isSASS(cssDocument)
        ) {
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

        if (isSASS(cssDocument)) {
            return [];
        }

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

function isSASS(document: CSSDocument) {
    switch (extractLanguage(document)) {
        case 'sass':
        case 'text/sass':
            return true;
        default:
            return false;
    }
}

function extractLanguage(document: CSSDocument): string {
    const attrs = document.getAttributes();
    return attrs.lang || attrs.type;
}
