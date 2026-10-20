import ts from 'typescript';
import { FoldingRangeKind, Range } from 'vscode-languageserver';
import { FoldingRange } from 'vscode-languageserver-types';
import { Document, isInTag, mapRangeToOriginal, toRange } from '../../../lib/documents';
import { isNotNullOrUndefined } from '../../../utils';
import { FoldingRangeProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isTextSpanInGeneratedCode } from './utils';
import { LSConfigManager } from '../../../ls-config';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { collectSvelteBlockFolding } from '../../svelte/features/getSvelteBlockFolding';

export class FoldingRangeProviderImpl implements FoldingRangeProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {}
    private readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];

    async getFoldingRanges(document: Document): Promise<FoldingRange[]> {
        // don't use ls.getProgram unless it's necessary
        // this feature is pure syntactic and doesn't need type information

        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const foldingRanges =
            tsDoc.parserError && !document.moduleScriptInfo && !document.scriptInfo
                ? []
                : lang.getOutliningSpans(tsDoc.filePath);

        const lineFoldingOnly =
            !!this.configManager.getClientCapabilities()?.textDocument?.foldingRange
                ?.lineFoldingOnly;

        const result = foldingRanges
            .filter((span) => !isTextSpanInGeneratedCode(tsDoc.getFullText(), span.textSpan))
            .map((span) => ({
                originalRange: this.mapToOriginalRange(tsDoc, span.textSpan, document),
                span
            }))
            .map(({ originalRange, span }) =>
                this.convertOutliningSpan(span, document, originalRange, lineFoldingOnly)
            )
            .filter(isNotNullOrUndefined)
            .concat(
                collectSvelteBlockFolding(
                    document,
                    {
                        parserError: !!tsDoc.parserError,
                        walkSvelteAst: (visitor) => tsDoc.walkSvelteAst(visitor)
                    },
                    lineFoldingOnly
                )
            )
            .filter(
                lineFoldingOnly ? (r) => r.startLine < r.endLine : (r) => r.startLine <= r.endLine
            );

        return result;
    }

    private mapToOriginalRange(
        tsDoc: SvelteDocumentSnapshot,
        textSpan: ts.TextSpan,
        document: Document
    ) {
        const range = mapRangeToOriginal(tsDoc, convertRange(tsDoc, textSpan));
        const startOffset = document.offsetAt(range.start);

        if (range.start.line < 0 || range.end.line < 0 || range.start.line > range.end.line) {
            return;
        }

        if (
            isInTag(range.start, document.scriptInfo) ||
            isInTag(range.start, document.moduleScriptInfo)
        ) {
            return range;
        }

        const endOffset = document.offsetAt(range.end);
        const originalText = document.getText().slice(startOffset, endOffset);

        if (originalText.length === 0) {
            return;
        }

        const generatedText = tsDoc.getText(textSpan.start, textSpan.start + textSpan.length);
        const oneToOne = originalText.trim() === generatedText.trim();

        if (oneToOne) {
            return range;
        }
    }

    private convertOutliningSpan(
        span: ts.OutliningSpan,
        document: Document,
        originalRange: Range | undefined,
        lineFoldingOnly: boolean
    ): FoldingRange | null {
        if (!originalRange) {
            return null;
        }

        const end = lineFoldingOnly
            ? this.adjustFoldingEndToNotHideEnd(originalRange, document)
            : originalRange.end;

        const result = {
            startLine: originalRange.start.line,
            endLine: end.line,
            kind: this.getFoldingRangeKind(span),
            startCharacter: lineFoldingOnly ? undefined : originalRange.start.character,
            endCharacter: lineFoldingOnly ? undefined : end.character
        };

        return result;
    }

    private getFoldingRangeKind(span: ts.OutliningSpan): FoldingRangeKind | undefined {
        switch (span.kind) {
            case ts.OutliningSpanKind.Comment:
                return FoldingRangeKind.Comment;
            case ts.OutliningSpanKind.Region:
                return FoldingRangeKind.Region;
            case ts.OutliningSpanKind.Imports:
                return FoldingRangeKind.Imports;
            case ts.OutliningSpanKind.Code:
            default:
                return undefined;
        }
    }

    private adjustFoldingEndToNotHideEnd(
        range: Range,
        document: Document
    ): { line: number; character?: number } {
        // don't fold end bracket, brace...
        if (range.end.character > 0) {
            const text = document.getText();
            const offsetBeforeEnd = document.offsetAt({
                line: range.end.line,
                character: range.end.character - 1
            });
            const foldEndCharacter = text[offsetBeforeEnd];
            if (this.foldEndPairCharacters.includes(foldEndCharacter)) {
                return { line: this.previousLineOfEndLine(range.start.line, range.end.line) };
            }
        }

        return range.end;
    }

    private previousLineOfEndLine(startLine: number, endLine: number) {
        return Math.max(endLine - 1, startLine);
    }
}
