import ts from 'typescript';
import { Hover, Position } from 'vscode-languageserver';
import { Document, getWordAt, mapObjWithRangeToOriginal } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { SvelteDocumentSnapshot, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { getComponentAtPosition } from './utils';

export class HoverProviderImpl implements HoverProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const eventHoverInfo = this.getEventHoverInfo(lang, document, tsDoc, fragment, position);
        if (eventHoverInfo) {
            return eventHoverInfo;
        }

        const info = lang.getQuickInfoAtPosition(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position)),
        );
        if (!info) {
            return null;
        }

        const declaration = ts.displayPartsToString(info.displayParts);
        const documentation =
            typeof info.documentation === 'string'
                ? info.documentation
                : ts.displayPartsToString(info.documentation);

        // https://microsoft.github.io/language-server-protocol/specification#textDocument_hover
        const contents = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');

        return mapObjWithRangeToOriginal(fragment, {
            range: convertRange(fragment, info.textSpan),
            contents,
        });
    }

    private getEventHoverInfo(
        lang: ts.LanguageService,
        doc: Document,
        tsDoc: SvelteDocumentSnapshot,
        fragment: SvelteSnapshotFragment,
        originalPosition: Position,
    ): Hover | null {
        const possibleEventName = getWordAt(doc.getText(), doc.offsetAt(originalPosition), {
            left: /\S+$/,
            right: /[\s=]/,
        });
        if (!possibleEventName.startsWith('on:')) {
            return null;
        }

        const component = getComponentAtPosition(
            this.lsAndTsDocResolver,
            lang,
            doc,
            tsDoc,
            fragment,
            originalPosition,
        );
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
                event.doc || '',
            ].join('\n'),
        };
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
