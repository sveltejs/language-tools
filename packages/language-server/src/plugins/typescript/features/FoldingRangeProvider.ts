import ts from 'typescript';
import { FoldingRangeKind, Range } from 'vscode-languageserver';
import { FoldingRange } from 'vscode-languageserver-types';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { isNotNullOrUndefined } from '../../../utils';
import { FoldingRangeProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isTextSpanInGeneratedCode } from './utils';

export class FoldingRangeProviderImpl implements FoldingRangeProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}
    private readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];
    private readonly htmlRegionRegex = /^\s*<!--\s*#region\b/;
    private readonly htmlEndRegionRegex = /^\s*<!--\s*#endregion\b/;

    async getFoldingRange(document: Document): Promise<FoldingRange[]> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        const foldingRanges = lang.getOutliningSpans(tsDoc.filePath);

        const tags = [
            document.templateInfo,
            document.moduleScriptInfo,
            document.scriptInfo,
            document.styleInfo
        ]
            .filter(isNotNullOrUndefined)
            .map((tag): FoldingRange => {
                const startLine = document.positionAt(tag.container.start).line;
                return {
                    startLine,
                    endLine: this.previousLineOfEndLine(
                        startLine,
                        document.positionAt(tag.container.end).line
                    )
                };
            });

        const htmlRegionComments = this.collectHTMLRegionComment(document, tags);

        return foldingRanges
            .filter((span) => !isTextSpanInGeneratedCode(tsDoc.getFullText(), span.textSpan))
            .map((span) => ({
                originalRange: mapRangeToOriginal(tsDoc, convertRange(tsDoc, span.textSpan)),
                span
            }))
            .filter(
                ({ originalRange }) => originalRange.start.line >= 0 && originalRange.end.line >= 0
            )
            .map(({ originalRange, span }) =>
                this.convertOutliningSpan(span, document, originalRange)
            )
            .filter(isNotNullOrUndefined)
            .concat(tags)
            .concat(htmlRegionComments)
            .filter((foldingRange) => foldingRange.startLine !== foldingRange.endLine);
    }

    private convertOutliningSpan(
        span: ts.OutliningSpan,
        document: Document,
        originalRange: Range
    ): FoldingRange | null {
        return {
            startLine: originalRange.start.line,
            endLine: this.adjustFoldingEnd(originalRange, document),
            kind: this.getFoldingRangeKind(span)
        };
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

    private adjustFoldingEnd(range: Range, document: Document) {
        // don't fold end bracket, brace...
        if (range.end.character > 0) {
            const text = document.getText();
            const offsetBeforeEnd = document.offsetAt({
                line: range.end.line,
                character: range.end.character - 1
            });
            const foldEndCharacter = text[offsetBeforeEnd];
            if (this.foldEndPairCharacters.includes(foldEndCharacter)) {
                return this.previousLineOfEndLine(range.start.line, range.end.line);
            }
        }

        const slice = document.getText().slice(document.offsetAt(range.end));

        if (slice.startsWith('{:') || slice.startsWith('{/')) {
            return this.previousLineOfEndLine(range.start.line, range.end.line);
        }

        return range.end.line;
    }

    private previousLineOfEndLine(startLine: number, endLine: number) {
        return Math.max(endLine - 1, startLine);
    }

    private collectHTMLRegionComment(document: Document, tagRanges: FoldingRange[]) {
        const lines = document.content.split('\n');
        const result: FoldingRange[] = [];
        let startLine: number | undefined;

        for (let index = 0; index < lines.length; index++) {
            if (tagRanges.some((tag) => index >= tag.startLine && index <= tag.endLine)) {
                continue;
            }

            const line = lines[index];

            if (this.htmlRegionRegex.test(line)) {
                startLine = index;
                continue;
            }
            if (this.htmlEndRegionRegex.test(line) && startLine) {
                result.push({
                    startLine,
                    endLine: index - 1,
                    kind: FoldingRangeKind.Region
                });
                startLine = undefined;
            }
        }

        return result;
    }
}
