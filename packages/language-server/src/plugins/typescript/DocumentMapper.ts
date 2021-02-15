import { decode, SourceMapMappings, SourceMapSegment } from 'sourcemap-codec';
import { Position } from 'vscode-languageserver';
import { DocumentMapper } from '../../lib/documents';

export class ConsumerDocumentMapper implements DocumentMapper {
    private decoded?: SourceMapMappings;

    constructor(
        private rawMap: string,
        private sourceUri: string,
        private nrPrependesLines: number
    ) {}

    getOriginalPosition(generatedPosition: Position): Position {
        if (generatedPosition.line < 0) {
            return Position.create(-1, -1);
        }

        if (!this.decoded) {
            this.decoded = decode(this.rawMap);
        }

        const position = Position.create(
            generatedPosition.line - this.nrPrependesLines,
            generatedPosition.character
        );

        if (position.line >= this.decoded.length) {
            return Position.create(-1, -1);
        }

        const lineMatch = this.decoded[position.line];
        if (!lineMatch.length) {
            return Position.create(-1, -1);
        }

        const character = position.character;
        const characterMatch = lineMatch.find(
            (col, idx) =>
                idx + 1 === lineMatch.length ||
                (col[0] <= character && lineMatch[idx + 1][0] > character)
        );
        if (!isValidSegment(characterMatch)) {
            return Position.create(-1, -1);
        }

        return Position.create(characterMatch[2], characterMatch[3]);
    }

    getGeneratedPosition(originalPosition: Position): Position {
        if (!this.decoded) {
            this.decoded = decode(this.rawMap);
        }

        const lineMatches: [number, [number, number, number, number]][] = [];
        for (let line = 0; line < this.decoded.length; line++) {
            for (let column = 0; column < this.decoded[line].length; column++) {
                const entry = this.decoded[line][column];
                if (isSegmentOnSameLine(entry, originalPosition.line)) {
                    lineMatches.push([line, entry]);
                    if (entry[3] === originalPosition.character) {
                        return Position.create(line + this.nrPrependesLines, entry[0]);
                    }
                }
            }
        }

        if (!lineMatches.length) {
            return Position.create(-1, -1);
        }

        // Since the mappings are high resolution, we should never get to this point,
        // but we'll deal with it regardless.
        lineMatches.sort((m1, m2) => {
            const lineDiff = m1[0] - m2[0];
            if (lineDiff !== 0) {
                return lineDiff;
            }
            return m1[1][3] - m2[1][3];
        });
        const match = lineMatches.find(
            (match, idx) =>
                idx + 1 === lineMatches.length ||
                (match[1][3] <= originalPosition.character &&
                    lineMatches[idx + 1][1][3] > originalPosition.character)
        )!;
        return Position.create(match[1][2] + this.nrPrependesLines, match[0]);
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }

    getURL(): string {
        return this.sourceUri;
    }

    destroy() {}
}

function isSegmentOnSameLine(
    segment: SourceMapSegment,
    line: number
): segment is [number, number, number, number] {
    return segment[2] === line;
}

function isValidSegment(
    segment: SourceMapSegment | undefined
): segment is [number, number, number, number] {
    return !!segment && segment.length > 1;
}
