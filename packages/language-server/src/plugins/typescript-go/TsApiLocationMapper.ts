import { Location, Position, Range } from 'vscode-languageserver';
import { getLineOffsets, offsetAt, positionAt } from '../../lib/documents';
import { pathToUrl } from '../../utils';
import type { tsAst } from './types';

export interface OriginalLocation extends Location {
    /** Offsets in the original file */
    start: number;
    end: number;
}

/**
 * Maps between the code TS7 sees through the API (the virtual code of `.svelte` files, the file
 * itself otherwise) and LSP locations in the original files.
 *
 * Keeps line offsets per file, so create one per request rather than keeping it around.
 */
export class TsApiLocationMapper {
    private readonly lineOffsets = new Map<string, number[]>();

    constructor(private readonly ast: typeof tsAst) {}

    /**
     * The original location of `node`, or undefined if the content mapper doesn't map it for
     * `feature` (generated code, or a span whose feature mask hides it, like TS7's LSP does).
     * Without a feature, any mapping counts (e.g. for diagnostics, which have no feature bit).
     */
    toOriginalLocation(
        node: tsAst.Node,
        feature?: tsAst.SpanMapFeature
    ): OriginalLocation | undefined {
        const sourceFile = node.getSourceFile();
        if (!sourceFile) {
            return undefined;
        }
        const span = this.toOriginalSpan(sourceFile, node.getStart(), node.end, feature);
        if (!span) {
            return undefined;
        }
        return {
            uri: pathToUrl(sourceFile.fileName),
            range: this.toRange(sourceFile, span.start, span.end),
            ...span
        };
    }

    toOriginalSpan(
        sourceFile: tsAst.SourceFile,
        start: number,
        end: number,
        feature?: tsAst.SpanMapFeature
    ): { start: number; end: number } | undefined {
        if (!sourceFile.spanMap) {
            return { start, end };
        }
        const mapped =
            feature === undefined
                ? sourceFile.spanMap.virtualToOriginalSpan({ pos: start, end })
                : sourceFile.spanMap.virtualToOriginalSpanForFeature({ pos: start, end }, feature);
        if (mapped.fidelity === this.ast.SpanMapFidelity.None) {
            return undefined;
        }
        return { start: mapped.range.pos, end: mapped.range.end };
    }

    toRange(sourceFile: tsAst.SourceFile, originalStart: number, originalEnd: number): Range {
        const text = sourceFile.originalText;
        const lineOffsets = this.getLineOffsets(sourceFile);
        return Range.create(
            positionAt(originalStart, text, lineOffsets),
            positionAt(originalEnd, text, lineOffsets)
        );
    }

    toOriginalOffset(sourceFile: tsAst.SourceFile, position: Position): number {
        return offsetAt(position, sourceFile.originalText, this.getLineOffsets(sourceFile));
    }

    /** Virtual offsets of an original position, in order (a position may be emitted several times) */
    toVirtualOffsets(
        sourceFile: tsAst.SourceFile,
        originalOffset: number,
        feature: tsAst.SpanMapFeature
    ): number[] {
        if (!sourceFile.spanMap) {
            return [originalOffset];
        }
        return sourceFile.spanMap
            .originalToVirtualPositions(originalOffset, feature)
            .map((mapped) => mapped.position);
    }

    private getLineOffsets(sourceFile: tsAst.SourceFile) {
        let offsets = this.lineOffsets.get(sourceFile.fileName);
        if (!offsets) {
            offsets = getLineOffsets(sourceFile.originalText);
            this.lineOffsets.set(sourceFile.fileName, offsets);
        }
        return offsets;
    }
}
