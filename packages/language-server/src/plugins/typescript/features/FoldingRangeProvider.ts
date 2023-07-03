import ts from 'typescript';
import { Node } from 'vscode-html-languageservice';
import { FoldingRangeKind, Range } from 'vscode-languageserver';
import { FoldingRange } from 'vscode-languageserver-types';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { isNotNullOrUndefined } from '../../../utils';
import { FoldingRangeProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isTextSpanInGeneratedCode } from './utils';
import { LSConfigManager } from '../../../ls-config';
import { indentBasedFoldingRange, indentBasedFoldingRangeForTag } from '../../../lib/foldingRange/indentFolding';

export class FoldingRangeProviderImpl implements FoldingRangeProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {}
    private readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];
    private readonly htmlRegionRegex = /^\s*<!--\s*#region\b/;
    private readonly htmlEndRegionRegex = /^\s*<!--\s*#endregion\b/;

    async getFoldingRange(document: Document): Promise<FoldingRange[]> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        const foldingRanges =
            tsDoc.parserError && !document.moduleScriptInfo && !document.scriptInfo
                ? []
                : lang.getOutliningSpans(tsDoc.filePath);

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
        const templateRange = document.templateInfo
            ? indentBasedFoldingRangeForTag(document, document.templateInfo)
            : [];
        const lineFoldingOnly =
            !!this.configManager.getClientCapabilities()?.textDocument?.foldingRange
                ?.lineFoldingOnly;

        const result = foldingRanges
            .filter((span) => !isTextSpanInGeneratedCode(tsDoc.getFullText(), span.textSpan))
            .map((span) => ({
                originalRange: mapRangeToOriginal(tsDoc, convertRange(tsDoc, span.textSpan)),
                span
            }))
            .filter(
                ({ originalRange }) => originalRange.start.line >= 0 && originalRange.end.line >= 0
            )
            .map(({ originalRange, span }) =>
                this.convertOutliningSpan(span, document, originalRange, lineFoldingOnly)
            )
            .filter(isNotNullOrUndefined)
            .concat(tags, htmlRegionComments, templateRange)
            .concat(this.getFallbackFoldingIfParserError(document, tsDoc));

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
        if (range.end.character > 0) {
            const text = document.getText();
            const offsetBeforeEnd = document.offsetAt({
                line: range.end.line,
                character: range.end.character - 1
            });
            const foldEndCharacter = text[offsetBeforeEnd];
            if (this.foldEndPairCharacters.includes(foldEndCharacter)) {
                if (lineFoldingOnly) {
                    return { line: this.previousLineOfEndLine(range.start.line, range.end.line) };
                }

                return { line: range.end.line, character: range.end.character - 1 };
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

    private getFallbackFoldingIfParserError(
        document: Document,
        tsDoc: SvelteDocumentSnapshot
    ): FoldingRange[] {
        if (!tsDoc.parserError) {
            return [];
        }

        const htmlResult = new Map<number, FoldingRange>();

        for (const node of document.html.roots) {
            if (node.tag === 'script' || node.tag === 'style' || node.tag === 'template') {
                continue;
            }

            this.collectFallbackHtmlFoldingRanges(document, node, htmlResult);
        }

        const tagRanges = [
            document.templateInfo,
            document.moduleScriptInfo,
            document.styleInfo,
            document.scriptInfo
        ]
            .filter(isNotNullOrUndefined)
            .map((tag) => ({
                startLine: document.positionAt(tag.container.start).line,
                endLine: document.positionAt(tag.container.end).line
            }));

        const svelteTagResult = indentBasedFoldingRange({
            document,
            skipFold: (line, lineContent) => {
                return (
                    htmlResult.has(line) ||
                    (!lineContent.includes('{#') &&
                        !lineContent.includes('{/') &&
                        !lineContent.includes('{:'))
                );
            },
            skipRanges: tagRanges
        });

        return [...htmlResult.values(), ...svelteTagResult];
    }

    private collectFallbackHtmlFoldingRanges(
        document: Document,
        node: Node,
        result: Map<number, FoldingRange>
    ) {
        const startLine = document.positionAt(node.start).line;
        const endLine = document.positionAt(node.end).line - 1;

        if (endLine <= startLine) {
            return;
        }

        if (!result.has(startLine)) {
            result.set(startLine, {
                startLine,
                endLine,
                kind: FoldingRangeKind.Region
            });
        }

        for (const child of node.children) {
            this.collectFallbackHtmlFoldingRanges(document, child, result);
        }
    }
}
