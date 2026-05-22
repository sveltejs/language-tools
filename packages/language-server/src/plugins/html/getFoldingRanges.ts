import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver-types';
import { Document } from '../../lib/documents';
import { Node } from 'vscode-html-languageservice';
import { scanCommentWithinTextOrComment } from '../../lib/documents/parseHtml';

const COMMENT_START = '<!--';
const regionRegex = /^\s*#(region\b)|(endregion\b)/;

export function getFoldingRanges(
    document: Document,
    capability: { lineFoldingOnly?: boolean } = {}
): FoldingRange[] {
    const foldingRanges: FoldingRange[] = [];

    const foldingStacks: Array<Node | { tag: '#region'; start: number }> = [];

    const text = document.getText();
    let offset = 0;
    let pendingCommentStart = text.indexOf(COMMENT_START, offset);

    collectionFoldingRangeForNodes(document.html.roots, 0, text.length);

    if (!capability.lineFoldingOnly) {
        return foldingRanges.filter((r) => r.startLine <= r.endLine);
    }

    const lineFoldingResults = new Map<number, FoldingRange>();
    for (const r of foldingRanges) {
        const startLine = r.startLine;
        const endLine =
            r.kind === FoldingRangeKind.Comment || r.kind === FoldingRangeKind.Region
                ? r.endLine
                : previousLineOfEndLine(startLine, r.endLine);
        if (startLine < endLine && !lineFoldingResults.has(startLine)) {
            const foldingRange: FoldingRange = {
                startLine,
                endLine
            };
            if (r.kind) {
                foldingRange.kind = r.kind;
            }
            lineFoldingResults.set(startLine, foldingRange);
        }
    }
    return Array.from(lineFoldingResults.values());

    function collectFoldingRanges(node: Node) {
        foldingStacks.push(node);
        if (node.startTagEnd !== undefined && node.endTagStart !== undefined) {
            collectionFoldingRangeForNodes(node.children, node.startTagEnd, node.endTagStart);
        }
        const index = foldingStacks.lastIndexOf(node);
        if (index !== -1) {
            // discard everything after the current node, it's most likely a overlapping folding range.
            foldingStacks.length = index;
            addFoldingRange(node.start, node.end);
        }
    }

    function collectionFoldingRangeForNodes(
        nodes: Node[],
        containerStart: number,
        containerEnd: number
    ) {
        if (!nodes.length) {
            checkCommentsInRange(containerStart, containerEnd);
            return;
        }
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            const commentCheckStart = i === 0 ? containerStart : nodes[i - 1].end;
            checkCommentsInRange(commentCheckStart, node.start);
            collectFoldingRanges(node);
        }

        const lastNode = nodes[nodes.length - 1];
        checkCommentsInRange(lastNode.end, containerEnd);
    }

    function checkCommentsInRange(start: number, end: number) {
        if (pendingCommentStart < start || pendingCommentStart > end) {
            return;
        }

        const comments = scanCommentWithinTextOrComment(text, start, end);
        for (const comment of comments) {
            const commentText = text.substring(comment.start, comment.end);

            const match = regionRegex.exec(commentText);
            if (!match) {
                addFoldingRange(comment.start, comment.end, FoldingRangeKind.Comment);
                continue;
            }

            const isStartRegion = !!match[1];
            if (isStartRegion) {
                foldingStacks.push({ start: comment.start, tag: '#region' });
                continue;
            }

            let startRegionIndex = foldingStacks.length - 1;
            while (startRegionIndex >= 0) {
                const s = foldingStacks[startRegionIndex];
                if (s.tag === '#region') {
                    break;
                }
                startRegionIndex--;
            }
            if (startRegionIndex === -1) {
                continue;
            }
            const startOffset = foldingStacks[startRegionIndex].start;
            foldingStacks.length = startRegionIndex;
            if (startOffset !== undefined) {
                addFoldingRange(startOffset, comment.end, FoldingRangeKind.Region);
            }
        }
        pendingCommentStart = text.indexOf(COMMENT_START, end);
    }

    function addFoldingRange(start: number, end: number, kind?: FoldingRangeKind) {
        const startPos = document.positionAt(start);
        const endPos = document.positionAt(end);
        foldingRanges.push({
            startLine: startPos.line,
            startCharacter: startPos.character,
            endLine: endPos.line,
            endCharacter: endPos.character,
            kind
        });
    }
}

function previousLineOfEndLine(startLine: number, endLine: number) {
    return Math.max(endLine - 1, startLine);
}
