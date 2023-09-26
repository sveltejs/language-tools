import { sum } from 'lodash';
import { FoldingRange } from 'vscode-languageserver-types';
import { Document, TagInformation } from '../documents';

/**
 *
 * 1. check tab and space counts for lines
 * 2. if there're mixing space and tab guess the tabSize otherwise we only need to compare the numbers of spaces or tabs between lines.
 */
export function indentBasedFoldingRangeForTag(
    document: Document,
    tag: TagInformation
): FoldingRange[] {
    if (tag.startPos.line === tag.endPos.line) {
        return [];
    }

    const startLine = tag.startPos.line + 1;
    const endLine = tag.endPos.line - 1;

    if (startLine > endLine || startLine === endLine) {
        return [];
    }

    return indentBasedFoldingRange({ document, ranges: [{ startLine, endLine }] });
}

export interface LineRange {
    startLine: number;
    endLine: number;
}

export function indentBasedFoldingRange({
    document,
    ranges,
    skipFold
}: {
    document: Document;
    ranges?: LineRange[] | undefined;
    skipFold?: (startLine: number, startLineContent: string) => boolean;
}): FoldingRange[] {
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const indents = lines
        .map((line, index) => ({
            ...collectIndents(line),
            index
        }))
        .filter((line) => !line.empty);

    const tabs = sum(indents.map((l) => l.tabCount));
    const spaces = sum(indents.map((l) => l.spaceCount));

    const tabSize = tabs && spaces ? guessTabSize(indents) : 4;

    let currentIndent: number | undefined;
    const result: FoldingRange[] = [];
    const unfinishedFolds = new Map<number, { startLine: number; endLine: number }>();
    ranges ??= [{ startLine: 0, endLine: lines.length - 1 }];
    let rangeIndex = 0;
    let range = ranges[rangeIndex++];

    if (!range) {
        return [];
    }

    for (const indentInfo of indents) {
        if (indentInfo.index < range.startLine || indentInfo.empty) {
            continue;
        }

        if (indentInfo.index > range.endLine) {
            for (const fold of unfinishedFolds.values()) {
                fold.endLine = range.endLine;
            }

            range = ranges[rangeIndex++];
            if (!range) {
                break;
            }
        }

        const lineIndent = indentInfo.tabCount * tabSize + indentInfo.spaceCount;

        currentIndent ??= lineIndent;

        if (lineIndent > currentIndent) {
            const startLine = indentInfo.index - 1;
            if (!skipFold?.(startLine, lines[startLine])) {
                const fold = { startLine, endLine: indentInfo.index };
                unfinishedFolds.set(currentIndent, fold);
                result.push(fold);
            }

            currentIndent = lineIndent;
        }

        if (lineIndent < currentIndent) {
            const last = unfinishedFolds.get(lineIndent);
            unfinishedFolds.delete(lineIndent);
            if (last) {
                last.endLine = Math.max(last.endLine, indentInfo.index - 1);
            }

            currentIndent = lineIndent;
        }
    }

    return result;
}

function collectIndents(line: string) {
    let tabCount = 0;
    let spaceCount = 0;
    let empty = true;

    for (let index = 0; index < line.length; index++) {
        const char = line[index];

        if (char === '\t') {
            tabCount++;
        } else if (char === ' ') {
            spaceCount++;
        } else {
            empty = false;
            break;
        }
    }

    return { tabCount, spaceCount, empty };
}

/**
 *
 * The indentation guessing is based on the indentation difference between lines.
 * And if the count equals, then the one used more often takes priority.
 */
export function guessTabSize(
    nonEmptyLines: Array<{ spaceCount: number; tabCount: number }>
): number {
    // simplified version of
    // https://github.com/microsoft/vscode/blob/559e9beea981b47ffd76d90158ccccafef663324/src/vs/editor/common/model/indentationGuesser.ts#L106
    if (nonEmptyLines.length === 1) {
        return 4;
    }

    const guessingTabSize = [2, 4, 6, 8, 3, 5, 7];
    const MAX_GUESS = 8;
    const matchCounts = new Map<number, number>();

    for (let index = 0; index < nonEmptyLines.length; index++) {
        const line = nonEmptyLines[index];
        const previousLine = nonEmptyLines[index - 1] ?? { spaceCount: 0, tabCount: 0 };

        const spaceDiff = Math.abs(line.spaceCount - previousLine.spaceCount);
        const tabDiff = Math.abs(line.tabCount - previousLine.tabCount);
        const diff =
            tabDiff === 0 ? spaceDiff : spaceDiff % tabDiff === 0 ? spaceDiff / tabDiff : 0;

        if (diff === 0 || diff > MAX_GUESS) {
            continue;
        }

        for (const guess of guessingTabSize) {
            if (diff === guess) {
                matchCounts.set(guess, (matchCounts.get(guess) ?? 0) + 1);
            }
        }
    }

    let max = 0;
    let tabSize: number | undefined;
    for (const [size, count] of matchCounts) {
        max = Math.max(max, count);
        if (max === count) {
            tabSize = size;
        }
    }

    const match4 = matchCounts.get(4);
    const match2 = matchCounts.get(2);
    if (tabSize === 4 && match4 && match4 > 0 && match2 && match2 > 0 && match2 >= match4 / 2) {
        tabSize = 2;
    }

    return tabSize ?? 4;
}
