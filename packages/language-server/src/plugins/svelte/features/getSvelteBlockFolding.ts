import { FoldingRange } from 'vscode-languageserver-types';
import {
    findElseBlockTagStart,
    findIfBlockEndTagStart,
    hasElseBlock,
    isAwaitBlock,
    isEachBlock,
    isElseBlockWithElseIf,
    SvelteNode,
    SvelteNodeWalker
} from './svelte-ast-utils';
import { Document, toRange } from '../../../lib/documents';
import { indentBasedFoldingRange, LineRange } from '../../../lib/foldingRange/indentFolding';
import { isNotNullOrUndefined } from '../../../utils';

/**
 * Doing this here with the svelte2tsx's svelte ast is slightly
 * less prone to error and faster than
 * using the svelte ast in the svelte plugins.
 */
export function collectSvelteBlockFolding(
    document: Document,
    tsDoc: {
        parserError: boolean;
        walkSvelteAst: (visitor: { enter: SvelteNodeWalker['enter'] }) => void;
    },
    lineFoldingOnly: boolean
) {
    if (tsDoc.parserError) {
        return getSvelteTagFoldingIfParserError(document);
    }

    const ranges: FoldingRange[] = [];

    const enter: SvelteNodeWalker['enter'] = function (node, parent, key) {
        if (key === 'attributes') {
            this.skip();
        }

        // use sub-block for await block
        if (!node.type.endsWith('Block') || node.type === 'AwaitBlock') {
            return;
        }

        if (node.type === 'IfBlock') {
            getIfBlockFolding(node, document, ranges);
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
            ranges.push(createFoldingRange(document, beforeBlockStartTagEnd + 1, node.end));

            return;
        }

        if (isEachBlock(node)) {
            const start = document.getText().indexOf('}', (node.key ?? node.expression).end);
            const elseStart = node.else ? findElseBlockTagStart(document.getText(), node.else) : -1;

            ranges.push(
                createFoldingRange(document, start, elseStart === -1 ? node.end : elseStart)
            );

            return;
        }

        if ('expression' in node && node.expression && typeof node.expression === 'object') {
            const start = getStartForNodeWithExpression(
                node as SvelteNode & { expression: SvelteNode },
                document
            );
            const end = node.end;

            ranges.push(createFoldingRange(document, start, end));
            return;
        }

        if (node.start != null && node.end != null) {
            const start = node.start;
            const end = node.end;

            ranges.push(createFoldingRange(document, start, end));
        }
    };

    tsDoc.walkSvelteAst({
        enter
    });

    if (lineFoldingOnly) {
        return ranges.map((r) => ({
            startLine: r.startLine,
            endLine: previousLineOfEndLine(r.startLine, r.endLine)
        }));
    }

    return ranges;
}

function previousLineOfEndLine(startLine: number, endLine: number) {
    return Math.max(endLine - 1, startLine);
}

function getIfBlockFolding(node: SvelteNode, document: Document, ranges: FoldingRange[]) {
    const typed = node as SvelteNode & {
        else?: SvelteNode;
        expression: SvelteNode;
    };

    const documentText = document.getText();
    const start = getStartForNodeWithExpression(typed, document);
    const end = hasElseBlock(typed)
        ? findElseBlockTagStart(documentText, typed.else)
        : findIfBlockEndTagStart(documentText, typed);

    ranges.push(createFoldingRange(document, start, end));
}

function getStartForNodeWithExpression(
    node: SvelteNode & { expression: SvelteNode },
    document: Document
) {
    return document.getText().indexOf('}', node.expression.end) + 1;
}

function createFoldingRange(document: Document, start: number, end: number) {
    const range = toRange(document, start, end);
    return {
        startLine: range.start.line,
        startCharacter: range.start.character,
        endLine: range.end.line,
        endCharacter: range.end.character
    };
}

function getSvelteTagFoldingIfParserError(document: Document) {
    const htmlTemplateRanges = getHtmlTemplateRangesForChecking(document);

    return indentBasedFoldingRange({
        document,
        skipFold: (_, lineContent) => {
            return !/{\s*(#|\/|:)/.test(lineContent);
        },
        ranges: htmlTemplateRanges
    });
}

function getHtmlTemplateRangesForChecking(document: Document) {
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
