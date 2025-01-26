import ts from 'typescript';
import { Position, DocumentHighlight } from 'vscode-languageserver-protocol';
import { DocumentHighlightKind, Range } from 'vscode-languageserver-types';
import { Document, inStyleOrScript } from '../../../lib/documents';
import { flatten, isSamePosition } from '../../../utils';
import { DocumentHighlightProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange } from '../utils';
import { isInGeneratedCode } from './utils';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import { walkSvelteAst } from '../svelte-ast-utils';

type RangeTupleArray = Array<[start: number, end: number]>;

export class DocumentHighlightProviderImpl implements DocumentHighlightProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}
    async findDocumentHighlight(
        document: Document,
        position: Position
    ): Promise<DocumentHighlight[] | null> {
        const { tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const svelteResult = await this.getSvelteDocumentHighlight(document, tsDoc, position);

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

        const result = flatten(highlights.map((highlight) => highlight.highlightSpans))
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

    private async getSvelteDocumentHighlight(
        document: Document,
        tsDoc: SvelteDocumentSnapshot,
        position: Position
    ): Promise<DocumentHighlight[] | null> {
        if (inStyleOrScript(document, position)) {
            return null;
        }

        const offset = document.offsetAt(position);

        const offsetStart = Math.max(offset - 10, 0);
        const charactersAroundOffset = document
            .getText()
            // use last 10 and next 10 characters, should cover 99% of all cases
            .substr(offsetStart, 20);

        if (
            !['#', '/', ':', '@', 'then', 'catch'].some((keyword) =>
                charactersAroundOffset.includes(keyword)
            )
        ) {
            return null;
        }

        const candidate = this.findCandidateSvelteTag(tsDoc, offset);

        if (!candidate) {
            return null;
        }

        if (candidate.type.endsWith('Tag')) {
            return this.getTagHighlight(offset, document, candidate);
        }

        if (candidate.type.endsWith('Block')) {
            return this.getBlockHighlight(offset, document, candidate);
        }

        return null;
    }

    private findCandidateSvelteTag(tsDoc: SvelteDocumentSnapshot, offset: number) {
        let candidate: TemplateNode | undefined;
        const subBlocks = ['ThenBlock', 'CatchBlock', 'PendingBlock', 'ElseBlock'];

        tsDoc.walkSvelteAst({
            enter(node, parent, key) {
                if (node.type === 'Fragment') {
                    return;
                }

                const templateNode = node as TemplateNode;
                const isWithin = templateNode.start <= offset && templateNode.end >= offset;

                const canSkip =
                    !isWithin ||
                    key === 'expression' ||
                    key === 'context' ||
                    ((parent.type === 'InlineComponent' || parent.type === 'Element') &&
                        key !== 'children');

                if (canSkip) {
                    this.skip();
                    return;
                }

                if (node.type.endsWith('Tag')) {
                    candidate = templateNode;
                    return;
                }

                // don't use sub-blocks so we can highlight the whole block
                if (node.type.endsWith('Block') && !subBlocks.includes(node.type)) {
                    if (
                        // else if
                        node.type === 'IfBlock' &&
                        parent.type === 'ElseBlock' &&
                        parent.start === node.start
                    ) {
                        return;
                    }
                    candidate = templateNode;
                    return;
                }
            }
        });

        return candidate;
    }

    private getTagHighlight(
        offset: number,
        document: Document,
        candidate: TemplateNode
    ): DocumentHighlight[] | null {
        const name =
            candidate.type === 'RawMustacheTag'
                ? 'html'
                : candidate.type.replace('Tag', '').toLocaleLowerCase();

        const startTag = '@' + name;
        const indexOfName = document.getText().indexOf(startTag, candidate.start);

        if (indexOfName < 0 || indexOfName > offset || candidate.start + startTag.length < offset) {
            return null;
        }

        return [
            {
                kind: DocumentHighlightKind.Read,
                range: Range.create(
                    document.positionAt(indexOfName),
                    document.positionAt(indexOfName + startTag.length)
                )
            }
        ];
    }

    private getBlockHighlight(
        offset: number,
        document: Document,
        candidate: TemplateNode
    ): DocumentHighlight[] | null {
        const name = candidate.type.replace('Block', '').toLowerCase();

        const startTag = '#' + name;
        const startTagStart = document.getText().indexOf(startTag, candidate.start);

        if (startTagStart < 0) {
            return null;
        }

        const ranges: RangeTupleArray = [];

        ranges.push([startTagStart, startTagStart + startTag.length]);

        const content = document.getText();
        const endTag = '/' + name;
        const endTagStart = content.lastIndexOf(endTag, candidate.end);

        if (endTagStart < startTagStart) {
            return null; // can happen in loose parser mode for unclosed tags
        }

        ranges.push([endTagStart, endTagStart + endTag.length]);

        if (candidate.type === 'EachBlock' && candidate.else) {
            const elseStart = content.lastIndexOf(':else', candidate.else.start);

            ranges.push([elseStart, elseStart + ':else'.length]);
        }

        ranges.push(
            ...this.getElseHighlightsForIfBlock(candidate, content),
            ...this.getAwaitBlockHighlight(candidate, content)
        );

        if (!ranges.some(([start, end]) => offset >= start && offset <= end)) {
            return null;
        }

        return ranges.map(([start, end]) => ({
            range: Range.create(document.positionAt(start), document.positionAt(end)),
            kind: DocumentHighlightKind.Read
        }));
    }

    private getElseHighlightsForIfBlock(candidate: TemplateNode, content: string): RangeTupleArray {
        if (candidate.type !== 'IfBlock' || !candidate.else) {
            return [];
        }

        const ranges = new Map<number, RangeTupleArray[number]>();

        walkSvelteAst(candidate.else, {
            enter(node) {
                const templateNode = node as TemplateNode;
                if (templateNode.type === 'IfBlock' && templateNode.elseif) {
                    const elseIfStart = content.lastIndexOf(
                        ':else if',
                        templateNode.expression.start
                    );

                    if (elseIfStart > 0) {
                        ranges.set(elseIfStart, [elseIfStart, elseIfStart + ':else if'.length]);
                    }
                }

                if (templateNode.type === 'ElseBlock') {
                    const elseStart = content.lastIndexOf(':else', templateNode.start);

                    if (
                        elseStart > 0 &&
                        content.slice(elseStart, elseStart + ':else if'.length) !== ':else if'
                    ) {
                        ranges.set(elseStart, [elseStart, elseStart + ':else'.length]);
                    }
                }
            }
        });

        return Array.from(ranges.values());
    }

    private getAwaitBlockHighlight(candidate: TemplateNode, content: string): RangeTupleArray {
        if (candidate.type !== 'AwaitBlock' || (candidate.then.skip && candidate.catch.skip)) {
            return [];
        }

        const ranges: RangeTupleArray = [];

        if (candidate.value) {
            const thenKeyword = candidate.pending.skip ? 'then' : ':then';

            const thenStart = content.lastIndexOf(thenKeyword, candidate.value.start);

            ranges.push([thenStart, thenStart + thenKeyword.length]);
        }

        // {#await promise catch error} or {:catch error}
        if (candidate.error) {
            const catchKeyword = candidate.pending.skip && candidate.then.skip ? 'catch' : ':catch';

            const catchStart = content.lastIndexOf(catchKeyword, candidate.error.start);

            ranges.push([catchStart, catchStart + catchKeyword.length]);
        } else if (!candidate.catch.skip) {
            // {:catch}

            const catchStart = content.indexOf(':catch', candidate.catch.start);

            ranges.push([catchStart, catchStart + ':catch'.length]);
        }

        return ranges;
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
