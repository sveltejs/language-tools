import ts from 'typescript';
import { Hover, Position } from 'vscode-languageserver';
import {
    Document,
    getNodeIfIsInTagName,
    getWordAt,
    mapObjWithRangeToOriginal
} from '../../../lib/documents';
import { HoverContext, HoverProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../previewer';
import { convertRange } from '../utils';
import { getComponentAtPosition, getCustomElementsDocument } from './utils';
import { LanguageServiceContainer } from '../service';
import { ComponentInfoProvider } from '../ComponentInfoProvider';

export class HoverProviderImpl implements HoverProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async doHover(
        document: Document,
        position: Position,
        context?: HoverContext
    ): Promise<Hover | null> {
        const { lang, lsContainer, tsDoc, userPreferences } = await this.getLSAndTSDoc(document);

        const eventHoverInfo = this.getEventHoverInfo(lang, document, tsDoc, position);
        if (eventHoverInfo) {
            return eventHoverInfo;
        }

        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        console.log('Hover requested at offset', offset, 'with context', context);

        const customElementDescription = this.getCustomElementDescription(
            lang,
            position,
            lsContainer,
            document,
            tsDoc
        );
        if (customElementDescription) {
            return {
                contents: {
                    value: customElementDescription,
                    kind: 'markdown'
                }
            };
        }

        let verbosityLevel = context?.verbosityLevel;
        let componentPropInfo: ts.QuickInfo | undefined;

        if (verbosityLevel) {
            const componentInfo = getComponentAtPosition(
                lang,
                document,
                tsDoc,
                position,
                /*includeEndTag*/ true
            );
            if (componentInfo) {
                // verbose component hover is not really useful. Formatting it ourselves.
                componentPropInfo = this.getComponentVerboseHoverInfo(
                    componentInfo,
                    lang,
                    userPreferences,
                    verbosityLevel
                );
                verbosityLevel = undefined;
            }
        }

        const options = [userPreferences.maximumHoverLength, verbosityLevel];
        const info = lang.getQuickInfoAtPosition(tsDoc.filePath, offset, ...options);

        if (!info) {
            return null;
        }

        let declaration = ts.displayPartsToString(info.displayParts);
        if (
            tsDoc.isSvelte5Plus &&
            declaration.includes('(alias)') &&
            declaration.includes('__sveltets_2_IsomorphicComponent')
        ) {
            // info ends with "import ComponentName"
            declaration = declaration.substring(declaration.lastIndexOf('import'));
        }

        const documentation = getMarkdownDocumentation(info.documentation, info.tags);
        const declarationMarkdown = this.tsCodeFence(declaration);
        const propsMarkdown = componentPropInfo
            ? this.tsCodeFence(ts.displayPartsToString(componentPropInfo.displayParts))
            : [];

        // https://microsoft.github.io/language-server-protocol/specification#textDocument_hover
        const contents = declarationMarkdown
            .concat(propsMarkdown)
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');

        return mapObjWithRangeToOriginal(tsDoc, {
            range: convertRange(tsDoc, info.textSpan),
            contents,
            canIncreaseVerbosityLevel:
                info.canIncreaseVerbosityLevel || componentPropInfo?.canIncreaseVerbosityLevel
        });
    }

    private tsCodeFence(declaration: string): string[] {
        return ['```typescript', declaration, '```'];
    }

    private getCustomElementDescription(
        lang: ts.LanguageService,
        position: Position,
        lsContainer: LanguageServiceContainer,
        document: Document,
        tsDoc: SvelteDocumentSnapshot
    ): string | undefined {
        const offset = document.offsetAt(position);
        const tag = getNodeIfIsInTagName(document.html, offset);
        if (!tag || !tag.tag) {
            return;
        }

        return getCustomElementsDocument(lang, lsContainer, tsDoc, tag.tag) ?? undefined;
    }

    private getEventHoverInfo(
        lang: ts.LanguageService,
        doc: Document,
        tsDoc: SvelteDocumentSnapshot,
        originalPosition: Position
    ): Hover | null {
        const possibleEventName = getWordAt(doc.getText(), doc.offsetAt(originalPosition), {
            left: /\S+$/,
            right: /[\s=]/
        });
        if (!possibleEventName.startsWith('on:')) {
            return null;
        }

        const component = getComponentAtPosition(lang, doc, tsDoc, originalPosition);
        if (!component) {
            return null;
        }

        const eventName = possibleEventName.substr('on:'.length);
        const event = component.getEvents().find((event) => event.name === eventName);
        if (!event) {
            return null;
        }

        return {
            contents: [
                '```typescript',
                `${event.name}: ${event.type}`,
                '```',
                event.doc || ''
            ].join('\n')
        };
    }

    private getComponentVerboseHoverInfo(
        componentInfo: ComponentInfoProvider,
        lang: ts.LanguageService,
        preferences: ts.UserPreferences,
        verbosityLevel: number
    ): ts.QuickInfo | undefined {
        const declaration = componentInfo.getPropsDefinition();
        if (!declaration) {
            return undefined;
        }

        let hoverNode: ts.Node | undefined;
        if (ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
            hoverNode = declaration.name;
        } else if (ts.isTypeLiteralNode(declaration) && declaration.parent) {
            // type literal hover is already expanded at level 0
            verbosityLevel = verbosityLevel - 1;
            if (ts.isTypeAliasDeclaration(declaration.parent)) {
                hoverNode = declaration.parent.name;
            } else if (
                declaration.parent.parent &&
                ts.isJSDocTypedefTag(declaration.parent.parent)
            ) {
                hoverNode = declaration.parent.parent.name;
            }
        }

        if (!hoverNode) {
            return undefined;
        }

        const options = [preferences.maximumHoverLength, verbosityLevel];
        const info = lang.getQuickInfoAtPosition(
            declaration.getSourceFile().fileName,
            hoverNode.getStart(),
            ...options
        );

        return info;
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
