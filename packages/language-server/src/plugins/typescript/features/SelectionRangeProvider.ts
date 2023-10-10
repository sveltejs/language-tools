import ts from 'typescript';
import { Position, Range, SelectionRange } from 'vscode-languageserver';
import { Document, mapSelectionRangeToParent } from '../../../lib/documents';
import { SelectionRangeProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';

export class SelectionRangeProviderImpl implements SelectionRangeProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<SelectionRange | null> {
        const { tsDoc, lang } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const tsSelectionRange = lang.getSmartSelectionRange(
            tsDoc.filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(position))
        );
        const selectionRange = this.toSelectionRange(tsDoc, tsSelectionRange);
        const mappedRange = mapSelectionRangeToParent(tsDoc, selectionRange);

        return this.filterOutUnmappedRange(mappedRange);
    }

    private toSelectionRange(
        snapshot: SvelteDocumentSnapshot,
        { textSpan, parent }: ts.SelectionRange
    ): SelectionRange {
        return {
            range: convertRange(snapshot, textSpan),
            parent: parent && this.toSelectionRange(snapshot, parent)
        };
    }

    private filterOutUnmappedRange(selectionRange: SelectionRange): SelectionRange | null {
        const flattened = this.flattenAndReverseSelectionRange(selectionRange);
        const filtered = flattened.filter((range) => range.start.line > 0 && range.end.line > 0);
        if (!filtered.length) {
            return null;
        }

        let result: SelectionRange | undefined;

        for (const selectionRange of filtered) {
            result = SelectionRange.create(selectionRange, result);
        }

        return result ?? null;
    }

    /**
     *   flatten the selection range and its parent to an array in reverse order
     * so it's easier to filter out unmapped selection and create a new tree of
     * selection range
     */
    private flattenAndReverseSelectionRange(selectionRange: SelectionRange) {
        const result: Range[] = [];
        let current = selectionRange;

        while (current.parent) {
            result.unshift(current.range);
            current = current.parent;
        }

        return result;
    }
}
