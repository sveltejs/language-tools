import ts from 'typescript';
import { Position, DocumentHighlight } from 'vscode-languageserver-protocol';
import { DocumentHighlightKind } from 'vscode-languageserver-types';
import { Document } from '../../../lib/documents';
import { isSamePosition } from '../../../utils';
import { DocumentHighlightProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange } from '../utils';
import { isInGeneratedCode } from './utils';
import { getSvelteDocumentHighlight } from '../../svelte/features/getSvelteDocumentHighlight';

export class DocumentHighlightProviderImpl implements DocumentHighlightProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}
    async findDocumentHighlight(
        document: Document,
        position: Position
    ): Promise<DocumentHighlight[] | null> {
        const { tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const svelteResult = getSvelteDocumentHighlight(document, tsDoc, position);

        if (svelteResult) {
            return svelteResult;
        }

        const { lang } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const highlights = lang
            .getDocumentHighlights(tsDoc.filePath, offset, [tsDoc.filePath])
            ?.filter((highlight) => highlight.fileName === tsDoc.filePath);

        if (!highlights?.length) {
            return null;
        }

        const result = highlights
            .flatMap((highlight) => highlight.highlightSpans)
            .filter(this.notInGeneratedCode(tsDoc.getFullText()))
            .map((highlight) =>
                DocumentHighlight.create(
                    convertToLocationRange(tsDoc, highlight.textSpan),
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

    private notInGeneratedCode(text: string) {
        return (ref: ts.HighlightSpan) => {
            return !isInGeneratedCode(
                text,
                ref.textSpan.start,
                ref.textSpan.start + ref.textSpan.length
            );
        };
    }
}
