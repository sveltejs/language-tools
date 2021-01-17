import { Position } from 'vscode-languageserver';
import { SourceMapConsumer } from 'source-map';
import { SourceMapDocumentMapper } from '../../lib/documents';

export class ConsumerDocumentMapper extends SourceMapDocumentMapper {
    constructor(
        consumer: SourceMapConsumer,
        sourceUri: string,
        generatedText: string,
        private nrPrependesLines: number
    ) {
        super(consumer, sourceUri, generatedText);
    }

    getOriginalPosition(generatedPosition: Position, bias?: number): Position {
        return super.getOriginalPosition(
            Position.create(
                generatedPosition.line - this.nrPrependesLines,
                generatedPosition.character
            ),
            bias
        );
    }

    getGeneratedPosition(originalPosition: Position): Position {
        const result = super.getGeneratedPosition(originalPosition);
        result.line += this.nrPrependesLines;
        return result;
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }
}
