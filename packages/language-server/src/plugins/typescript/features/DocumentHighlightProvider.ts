import ts from 'typescript';
import { Position, DocumentHighlight } from 'vscode-languageserver-protocol';
import { DocumentHighlightKind } from 'vscode-languageserver-types';
import { Document } from '../../../lib/documents';
import { flatten, isSamePosition } from '../../../utils';
import { DocumentHighlightProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange } from '../utils';
import { isNoTextSpanInGeneratedCode } from './utils';

export class DocumentHighlightProviderImpl implements DocumentHighlightProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}
    async findDocumentHighlight(
        document: Document,
        position: Position
    ): Promise<DocumentHighlight[] | null> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));
        const highlights = lang
            .getDocumentHighlights(tsDoc.filePath, offset, [tsDoc.filePath])
            ?.filter((highlight) => highlight.fileName === tsDoc.filePath);

        if (!highlights?.length) {
            return null;
        }

        const result = flatten(highlights.map((highlight) => highlight.highlightSpans))
            .filter(notInGeneratedCode(tsDoc.getFullText()))
            .map((highlight) =>
                DocumentHighlight.create(
                    convertToLocationRange(fragment, highlight.textSpan),
                    this.convertHighlightKind(highlight)
                )
            )
            .filter((highlight) => !isSamePosition(highlight.range.start, highlight.range.end));

        if (!result.length) {
            return null;
        }

        return result;
    }

    private convertHighlightKind(highlight: ts.HighlightSpan): DocumentHighlightKind | undefined {
        return highlight.kind === ts.HighlightSpanKind.writtenReference
            ? DocumentHighlightKind.Write
            : DocumentHighlightKind.Read;
    }
}

function notInGeneratedCode(text: string) {
    return (ref: ts.HighlightSpan) => {
        return isNoTextSpanInGeneratedCode(text, ref.textSpan);
    };
}
