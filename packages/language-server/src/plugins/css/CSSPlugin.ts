import { doComplete as doEmmetComplete } from '@vscode/emmet-helper';
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
    SelectionRange,
    WorkspaceFolder
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
    mapSelectionRangeToParent,
    isInTag,
    mapRangeToOriginal,
    TagInformation
} from '../../lib/documents';
import { LSConfigManager, LSCSSConfig } from '../../ls-config';
import {
    ColorPresentationsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    DocumentSymbolsProvider,
    FoldingRangeProvider,
    HoverProvider,
    SelectionRangeProvider
} from '../interfaces';
import { CSSDocument, CSSDocumentBase } from './CSSDocument';
import { CSSLanguageServices, getLanguage, getLanguageService } from './service';
import { GlobalVars } from './global-vars';
import { getIdClassCompletion } from './features/getIdClassCompletion';
import { AttributeContext, getAttributeContextAtPosition } from '../../lib/documents/parseHtml';
import { StyleAttributeDocument } from './StyleAttributeDocument';
import { getDocumentContext } from '../documentContext';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver-types';
import { indentBasedFoldingRangeForTag } from '../../lib/foldingRange/indentFolding';
import { isNotNullOrUndefined, urlToPath } from '../../utils';

export class CSSPlugin
    implements
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider,
        SelectionRangeProvider,
        FoldingRangeProvider
{
    __name = 'css';
    private configManager: LSConfigManager;
    private cssDocuments = new WeakMap<Document, CSSDocument>();
    private cssLanguageServices: CSSLanguageServices;
    private workspaceFolders: WorkspaceFolder[];
    private triggerCharacters = ['.', ':', '-', '/'];
    private globalVars: GlobalVars;

    constructor(
        docManager: DocumentManager,
        configManager: LSConfigManager,
        workspaceFolders: WorkspaceFolder[],
        cssLanguageServices: CSSLanguageServices
    ) {
        this.cssLanguageServices = cssLanguageServices;
        this.workspaceFolders = workspaceFolders;
        this.configManager = configManager;
        this.updateConfigs();
        const workspacePaths = workspaceFolders
            .map((folder) => urlToPath(folder.uri))
            .filter(isNotNullOrUndefined);
        this.globalVars = new GlobalVars(workspacePaths);

        this.globalVars.watchFiles(this.configManager.get('css.globals'));
        this.configManager.onChange((config) => {
            this.globalVars.watchFiles(config.get('css.globals'));
            this.updateConfigs();
        });

        docManager.on('documentChange', (document) =>
            this.cssDocuments.set(document, new CSSDocument(document, this.cssLanguageServices))
        );
        docManager.on('documentClose', (document) => this.cssDocuments.delete(document));
    }

    getSelectionRange(document: Document, position: Position): SelectionRange | null {
        if (!this.featureEnabled('selectionRange') || !isInTag(position, document.styleInfo)) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);
        const [range] = this.getLanguageService(extractLanguage(cssDocument)).getSelectionRanges(
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
        const kind = extractLanguage(cssDocument);

        if (shouldExcludeValidation(kind)) {
            return [];
        }

        return this.getLanguageService(kind)
            .doValidation(cssDocument, cssDocument.stylesheet)
            .map((diagnostic) => ({ ...diagnostic, source: getLanguage(kind) }))
            .map((diagnostic) => mapObjWithRangeToOriginal(cssDocument, diagnostic));
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);
        if (shouldExcludeHover(cssDocument)) {
            return null;
        }
        if (cssDocument.isInGenerated(position)) {
            return this.doHoverInternal(cssDocument, position);
        }
        const attributeContext = getAttributeContextAtPosition(document, position);
        if (
            attributeContext &&
            this.inStyleAttributeWithoutInterpolation(attributeContext, document.getText())
        ) {
            const [start, end] = attributeContext.valueRange;
            return this.doHoverInternal(
                new StyleAttributeDocument(document, start, end, this.cssLanguageServices),
                position
            );
        }

        return null;
    }
    private doHoverInternal(cssDocument: CSSDocumentBase, position: Position) {
        const hoverInfo = this.getLanguageService(extractLanguage(cssDocument)).doHover(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet
        );
        return hoverInfo ? mapHoverToParent(cssDocument, hoverInfo) : hoverInfo;
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        const triggerCharacter = completionContext?.triggerCharacter;
        const triggerKind = completionContext?.triggerKind;
        const isCustomTriggerCharacter = triggerKind === CompletionTriggerKind.TriggerCharacter;

        if (
            isCustomTriggerCharacter &&
            triggerCharacter &&
            !this.triggerCharacters.includes(triggerCharacter)
        ) {
            return null;
        }

        if (!this.featureEnabled('completions')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document);

        if (cssDocument.isInGenerated(position)) {
            return this.getCompletionsInternal(document, position, cssDocument);
        }

        const attributeContext = getAttributeContextAtPosition(document, position);
        if (!attributeContext) {
            return null;
        }

        if (this.inStyleAttributeWithoutInterpolation(attributeContext, document.getText())) {
            const [start, end] = attributeContext.valueRange;
            return this.getCompletionsInternal(
                document,
                position,
                new StyleAttributeDocument(document, start, end, this.cssLanguageServices)
            );
        } else {
            return getIdClassCompletion(cssDocument, attributeContext);
        }
    }

    private inStyleAttributeWithoutInterpolation(
        attrContext: AttributeContext,
        text: string
    ): attrContext is Required<AttributeContext> {
        return (
            attrContext.name === 'style' &&
            !!attrContext.valueRange &&
            !text.substring(attrContext.valueRange[0], attrContext.valueRange[1]).includes('{')
        );
    }

    private async getCompletionsInternal(
        document: Document,
        position: Position,
        cssDocument: CSSDocumentBase
    ) {
        if (isSASS(cssDocument)) {
            // the css language service does not support sass, still we can use
            // the emmet helper directly to at least get emmet completions
            return (
                doEmmetComplete(document, position, 'sass', this.configManager.getEmmetConfig()) ||
                null
            );
        }

        const type = extractLanguage(cssDocument);
        if (shouldExcludeCompletion(type)) {
            return null;
        }

        const lang = this.getLanguageService(type);
        let emmetResults: CompletionList = {
            isIncomplete: false,
            items: []
        };
        if (
            this.configManager.getConfig().css.completions.emmet &&
            this.configManager.getEmmetConfig().showExpandedAbbreviation !== 'never'
        ) {
            lang.setCompletionParticipants([
                {
                    onCssProperty: (context) => {
                        if (context?.propertyName) {
                            emmetResults =
                                doEmmetComplete(
                                    cssDocument,
                                    cssDocument.getGeneratedPosition(position),
                                    getLanguage(type),
                                    this.configManager.getEmmetConfig()
                                ) || emmetResults;
                        }
                    },
                    onCssPropertyValue: (context) => {
                        if (context?.propertyValue) {
                            emmetResults =
                                doEmmetComplete(
                                    cssDocument,
                                    cssDocument.getGeneratedPosition(position),
                                    getLanguage(type),
                                    this.configManager.getEmmetConfig()
                                ) || emmetResults;
                        }
                    }
                }
            ]);
        }

        const results = await lang.doComplete2(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet,
            getDocumentContext(cssDocument.uri, this.workspaceFolders)
        );
        return CompletionList.create(
            this.appendGlobalVars(
                [...(results ? results.items : []), ...emmetResults.items].map((completionItem) =>
                    mapCompletionItemToOriginal(cssDocument, completionItem)
                )
            ),
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0
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
                label: `var(${globalVar.name})`,
                sortText: '-',
                detail: `${globalVar.filename}\n\n${globalVar.name}: ${globalVar.value}`,
                kind: CompletionItemKind.Value
            }));
        return [...items, ...additionalItems];
    }

    getDocumentColors(document: Document): ColorInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        if (shouldExcludeColor(cssDocument)) {
            return [];
        }

        return this.getLanguageService(extractLanguage(cssDocument))
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
            shouldExcludeColor(cssDocument)
        ) {
            return [];
        }

        return this.getLanguageService(extractLanguage(cssDocument))
            .getColorPresentations(
                cssDocument,
                cssDocument.stylesheet,
                color,
                mapRangeToGenerated(cssDocument, range)
            )
            .map((colorPres) => mapColorPresentationToOriginal(cssDocument, colorPres));
    }

    getDocumentSymbols(document: Document): SymbolInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        if (shouldExcludeDocumentSymbols(cssDocument)) {
            return [];
        }

        return this.getLanguageService(extractLanguage(cssDocument))
            .findDocumentSymbols(cssDocument, cssDocument.stylesheet)
            .map((symbol) => {
                if (!symbol.containerName) {
                    return {
                        ...symbol,
                        // TODO: this could contain other things, e.g. style.myclass
                        containerName: 'style'
                    };
                }

                return symbol;
            })
            .map((symbol) => mapSymbolInformationToOriginal(cssDocument, symbol));
    }

    getFoldingRanges(document: Document): FoldingRange[] {
        if (!document.styleInfo) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document);

        if (shouldUseIndentBasedFolding(cssDocument.languageId)) {
            return this.nonSyntacticFolding(document, document.styleInfo);
        }

        return this.getLanguageService(extractLanguage(cssDocument))
            .getFoldingRanges(cssDocument)
            .map((range) => {
                const originalRange = mapRangeToOriginal(cssDocument, {
                    start: { line: range.startLine, character: range.startCharacter ?? 0 },
                    end: { line: range.endLine, character: range.endCharacter ?? 0 }
                });

                return {
                    startLine: originalRange.start.line,
                    endLine: originalRange.end.line,
                    kind: range.kind
                };
            });
    }

    private nonSyntacticFolding(document: Document, styleInfo: TagInformation): FoldingRange[] {
        const ranges = indentBasedFoldingRangeForTag(document, styleInfo);
        const startRegion = /^\s*(\/\/|\/\*\*?)\s*#?region\b/;
        const endRegion = /^\s*(\/\/|\/\*\*?)\s*#?endregion\b/;

        const lines = document
            .getText()
            .split(/\r?\n/)
            .slice(styleInfo.startPos.line, styleInfo.endPos.line);

        let start = -1;

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];

            if (startRegion.test(line)) {
                start = index;
            } else if (endRegion.test(line)) {
                if (start >= 0) {
                    ranges.push({
                        startLine: start + styleInfo.startPos.line,
                        endLine: index + styleInfo.startPos.line,
                        kind: FoldingRangeKind.Region
                    });
                }
                start = -1;
            }
        }

        return ranges.sort((a, b) => a.startLine - b.startLine);
    }

    private getCSSDoc(document: Document) {
        let cssDoc = this.cssDocuments.get(document);
        if (!cssDoc || cssDoc.version < document.version) {
            cssDoc = new CSSDocument(document, this.cssLanguageServices);
            this.cssDocuments.set(document, cssDoc);
        }
        return cssDoc;
    }

    private updateConfigs() {
        this.getLanguageService('css')?.configure(this.configManager.getCssConfig());
        this.getLanguageService('scss')?.configure(this.configManager.getScssConfig());
        this.getLanguageService('less')?.configure(this.configManager.getLessConfig());
    }

    private featureEnabled(feature: keyof LSCSSConfig) {
        return (
            this.configManager.enabled('css.enable') &&
            this.configManager.enabled(`css.${feature}.enable`)
        );
    }

    private getLanguageService(kind: string) {
        return getLanguageService(this.cssLanguageServices, kind);
    }
}

function shouldExcludeValidation(kind?: string) {
    switch (kind) {
        case 'postcss':
        case 'sass':
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function shouldExcludeCompletion(kind?: string) {
    switch (kind) {
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function shouldExcludeDocumentSymbols(document: CSSDocument) {
    switch (extractLanguage(document)) {
        case 'sass':
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function shouldExcludeHover(document: CSSDocument) {
    switch (extractLanguage(document)) {
        case 'sass':
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function shouldExcludeColor(document: CSSDocument) {
    switch (extractLanguage(document)) {
        case 'sass':
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function shouldUseIndentBasedFolding(kind?: string) {
    switch (kind) {
        case 'postcss':
        case 'sass':
        case 'stylus':
        case 'styl':
            return true;
        default:
            return false;
    }
}

function isSASS(document: CSSDocumentBase) {
    switch (extractLanguage(document)) {
        case 'sass':
            return true;
        default:
            return false;
    }
}

function extractLanguage(document: CSSDocumentBase): string {
    const lang = document.languageId;
    return lang.replace(/^text\//, '');
}
