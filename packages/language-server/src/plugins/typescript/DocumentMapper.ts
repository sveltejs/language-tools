import { Position } from 'vscode-languageserver';
import { SourceMapConsumer } from 'source-map';
import { DocumentMapper } from '../../lib/documents';

export class ConsumerDocumentMapper implements DocumentMapper {
    constructor(
        private consumer: SourceMapConsumer,
        private sourceUri: string,
        private nrPrependesLines: number,
    ) {}

    getOriginalPosition(generatedPosition: Position): Position {
        generatedPosition = Position.create(
            generatedPosition.line - this.nrPrependesLines,
            generatedPosition.character,
        );

        const mapped = this.consumer.originalPositionFor({
            line: generatedPosition.line + 1,
            column: generatedPosition.character,
        });

        if (!mapped) {
            return { line: -1, character: -1 };
        }

        if (mapped.line === 0) {
            console.warn('Got 0 mapped line from', generatedPosition, 'col was', mapped.column);
        }

        return {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0,
        };
    }

    getGeneratedPosition(originalPosition: Position): Position {
        const mapped = this.consumer.generatedPositionFor({
            line: originalPosition.line + 1,
            column: originalPosition.character,
            source: this.sourceUri,
        });

        if (!mapped) {
            return { line: -1, character: -1 };
        }

        const result = {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0,
        };

        if (result.line < 0) {
            return result;
        }

        result.line += this.nrPrependesLines;
        return result;
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }

    getURL(): string {
        return this.sourceUri;
    }
}
