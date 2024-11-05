import ts from 'typescript';
import { Hover, Position } from 'vscode-languageserver';
import { Document, getWordAt, mapObjWithRangeToOriginal } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../previewer';
import { convertRange } from '../utils';
import { getComponentAtPosition } from './utils';

export class HoverProviderImpl implements HoverProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);

        const eventHoverInfo = this.getEventHoverInfo(lang, document, tsDoc, position);
        if (eventHoverInfo) {
            return eventHoverInfo;
        }

        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const info = lang.getQuickInfoAtPosition(tsDoc.filePath, offset);
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

        // https://microsoft.github.io/language-server-protocol/specification#textDocument_hover
        const contents = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');

        return mapObjWithRangeToOriginal(tsDoc, {
            range: convertRange(tsDoc, info.textSpan),
            contents
        });
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

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
