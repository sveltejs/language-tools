import ts from 'typescript';
import { Node } from 'vscode-html-languageservice';
import { FoldingRangeKind, Range } from 'vscode-languageserver';
import { FoldingRange } from 'vscode-languageserver-types';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { isNotNullOrUndefined } from '../../../utils';
import { FoldingRangeProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isTextSpanInGeneratedCode } from './utils';
import { LSConfigManager } from '../../../ls-config';
import { LineRange, indentBasedFoldingRange } from '../../../lib/foldingRange/indentFolding';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';

export class FoldingRangeProviderImpl implements FoldingRangeProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {}
    private readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];

    async getFoldingRanges(document: Document): Promise<FoldingRange[]> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const foldingRanges =
            tsDoc.parserError && !document.moduleScriptInfo && !document.scriptInfo
                ? []
                : lang.getOutliningSpans(tsDoc.filePath);

        const lineFoldingOnly =
            !!this.configManager.getClientCapabilities()?.textDocument?.foldingRange
                ?.lineFoldingOnly;

        const htmlStartMap = new Map<number, Node>();
        const collectHTMLTag = (node: Node) => {
            htmlStartMap.set(node.start, node);
            node.children?.forEach(collectHTMLTag);
        };
        for (const node of document.html.roots) {
            collectHTMLTag(node);
        }

        const result = foldingRanges
            .filter((span) => !isTextSpanInGeneratedCode(tsDoc.getFullText(), span.textSpan))
            .map((span) => ({
                originalRange: mapRangeToOriginal(tsDoc, convertRange(tsDoc, span.textSpan)),
                span
            }))
            .filter(
                ({ originalRange }) =>
                    originalRange.start.line >= 0 &&
                    originalRange.end.line >= 0 &&
                    !htmlStartMap.has(document.offsetAt(originalRange.start))
            )
            .map(({ originalRange, span }) =>
                this.convertOutliningSpan(span, document, originalRange, lineFoldingOnly)
            )
            .filter(isNotNullOrUndefined)
            .concat(this.getSvelteTagFoldingIfParserError(document, tsDoc))
            .filter(
                (r) => r.startLine < r.endLine && (!lineFoldingOnly || r.startLine !== r.endLine)
            );

        return result;
    }

    private convertOutliningSpan(
        span: ts.OutliningSpan,
        document: Document,
        originalRange: Range,
        lineFoldingOnly: boolean
    ): FoldingRange | null {
        const end = this.adjustFoldingEnd(originalRange, document, lineFoldingOnly);
        return {
            startLine: originalRange.start.line,
            endLine: end.line,
            kind: this.getFoldingRangeKind(span),
            startCharacter: lineFoldingOnly ? undefined : originalRange.start.character,
            endCharacter: lineFoldingOnly ? undefined : end.character
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

    private adjustFoldingEnd(
        range: Range,
        document: Document,
        lineFoldingOnly: boolean
    ): { line: number; character?: number } {
        // don't fold end bracket, brace...
        if (range.end.character > 0 && lineFoldingOnly) {
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

        let endOffset = document.offsetAt(range.end);
        const elseKeyword = ':else';
        const lastPossibleOffsetIfOverlap = endOffset - elseKeyword.length + 1;
        const isMiddleOfElseBlock = document
            .getText()
            .slice(lastPossibleOffsetIfOverlap, endOffset + elseKeyword.length - 1)
            .includes(elseKeyword);

        if (isMiddleOfElseBlock) {
            endOffset = document
                .getText()
                .lastIndexOf(
                    '{',
                    document.getText().indexOf(elseKeyword, lastPossibleOffsetIfOverlap)
                );
            range.end = document.positionAt(endOffset);
        }

        if (!lineFoldingOnly) {
            return range.end;
        }

        const after = document.getText().slice(endOffset);

        if (after.startsWith('{:') || after.startsWith('{/')) {
            return { line: this.previousLineOfEndLine(range.start.line, range.end.line) };
        }

        return range.end;
    }

    private getSvelteTagFoldingIfParserError(document: Document, tsDoc: SvelteDocumentSnapshot) {
        if (!tsDoc.parserError) {
            return [];
        }

        const htmlTemplateRanges = this.getHtmlTemplateRangesForChecking(document);

        return indentBasedFoldingRange({
            document,
            skipFold: (_, lineContent) => {
                return (
                    !lineContent.includes('{#') &&
                    !lineContent.includes('{/') &&
                    !lineContent.includes('{:')
                );
            },
            ranges: htmlTemplateRanges
        });
    }

    private getHtmlTemplateRangesForChecking(document: Document) {
        const ranges: LineRange[] = [];

        const excludeTags = [
            document.templateInfo,
            document.moduleScriptInfo,
            document.scriptInfo,
            document.styleInfo
        ]
            .filter(isNotNullOrUndefined)
            .map((info) => ({
                startLine: document.positionAt(info.container.start).line,
                endLine: document.positionAt(info.container.end).line
            }))
            .sort((a, b) => a.startLine - b.startLine);

        if (excludeTags.length === 0) {
            return [{ startLine: 0, endLine: document.lineCount - 1 }];
        }

        if (excludeTags[0].startLine > 0) {
            ranges.push({
                startLine: 0,
                endLine: excludeTags[0].startLine - 1
            });
        }

        for (let index = 0; index < excludeTags.length; index++) {
            const element = excludeTags[index];
            const next = excludeTags[index + 1];

            ranges.push({
                startLine: element.endLine + 1,
                endLine: next ? next.startLine - 1 : document.lineCount - 1
            });
        }

        return ranges;
    }

    private previousLineOfEndLine(startLine: number, endLine: number) {
        return Math.max(endLine - 1, startLine);
    }
}
