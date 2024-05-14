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
import { LineRange, indentBasedFoldingRange } from '../../../lib/foldingRange/indentFolding';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import {
    SvelteNode,
    SvelteNodeWalker,
    findElseBlockTagStart,
    findIfBlockEndTagStart,
    hasElseBlock,
    isAwaitBlock,
    isEachBlock,
    isElseBlockWithElseIf
} from '../svelte-ast-utils';

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
            .concat(this.collectSvelteBlockFolding(document, tsDoc, lineFoldingOnly))
            .concat(this.getSvelteTagFoldingIfParserError(document, tsDoc))
            .filter((r) => (lineFoldingOnly ? r.startLine < r.endLine : r.startLine <= r.endLine));

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

    /**
     * Doing this here with the svelte2tsx's svelte ast is slightly
     * less prone to error and faster than
     * using the svelte ast in the svelte plugins.
     */
    private collectSvelteBlockFolding(
        document: Document,
        tsDoc: SvelteDocumentSnapshot,
        lineFoldingOnly: boolean
    ) {
        if (tsDoc.parserError) {
            return [];
        }

        const ranges: FoldingRange[] = [];

        const provider = this;
        const enter: SvelteNodeWalker['enter'] = function (node, parent, key) {
            if (key === 'attributes') {
                this.skip();
            }

            // use sub-block for await block
            if (!node.type.endsWith('Block') || node.type === 'AwaitBlock') {
                return;
            }

            if (node.type === 'IfBlock') {
                provider.getIfBlockFolding(node, document, ranges);
                return;
            }

            if (isElseBlockWithElseIf(node)) {
                return;
            }

            if ((node.type === 'CatchBlock' || node.type === 'ThenBlock') && isAwaitBlock(parent)) {
                const expressionEnd =
                    (node.type === 'CatchBlock' ? parent.error?.end : parent.value?.end) ??
                    document.getText().indexOf('}', node.start);

                const beforeBlockStartTagEnd = document.getText().indexOf('}', expressionEnd);
                if (beforeBlockStartTagEnd == -1) {
                    return;
                }
                ranges.push(
                    provider.createFoldingRange(document, beforeBlockStartTagEnd + 1, node.end)
                );

                return;
            }

            if (isEachBlock(node)) {
                const start = document.getText().indexOf('}', (node.key ?? node.expression).end);
                const elseStart = node.else
                    ? findElseBlockTagStart(document.getText(), node.else)
                    : -1;

                ranges.push(
                    provider.createFoldingRange(
                        document,
                        start,
                        elseStart === -1 ? node.end : elseStart
                    )
                );

                return;
            }

            if ('expression' in node && node.expression && typeof node.expression === 'object') {
                const start = provider.getStartForNodeWithExpression(
                    node as SvelteNode & { expression: SvelteNode },
                    document
                );
                const end = node.end;

                ranges.push(provider.createFoldingRange(document, start, end));
                return;
            }

            if (node.start != null && node.end != null) {
                const start = node.start;
                const end = node.end;

                ranges.push(provider.createFoldingRange(document, start, end));
            }
        };

        tsDoc.walkSvelteAst({
            enter
        });

        if (lineFoldingOnly) {
            return ranges.map((r) => ({
                startLine: r.startLine,
                endLine: this.previousLineOfEndLine(r.startLine, r.endLine)
            }));
        }

        return ranges;
    }

    private getIfBlockFolding(node: SvelteNode, document: Document, ranges: FoldingRange[]) {
        const typed = node as SvelteNode & {
            else?: SvelteNode;
            expression: SvelteNode;
        };

        const documentText = document.getText();
        const start = this.getStartForNodeWithExpression(typed, document);
        const end = hasElseBlock(typed)
            ? findElseBlockTagStart(documentText, typed.else)
            : findIfBlockEndTagStart(documentText, typed);

        ranges.push(this.createFoldingRange(document, start, end));
    }

    private getStartForNodeWithExpression(
        node: SvelteNode & { expression: SvelteNode },
        document: Document
    ) {
        return document.getText().indexOf('}', node.expression.end) + 1;
    }

    private createFoldingRange(document: Document, start: number, end: number) {
        const range = toRange(document, start, end);
        return {
            startLine: range.start.line,
            startCharacter: range.start.character,
            endLine: range.end.line,
            endCharacter: range.end.character
        };
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

    private getSvelteTagFoldingIfParserError(document: Document, tsDoc: SvelteDocumentSnapshot) {
        if (!tsDoc.parserError) {
            return [];
        }

        const htmlTemplateRanges = this.getHtmlTemplateRangesForChecking(document);

        return indentBasedFoldingRange({
            document,
            skipFold: (_, lineContent) => {
                return !/{\s*(#|\/|:)/.test(lineContent);
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
