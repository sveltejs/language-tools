import { Position } from 'vscode-languageserver';
import { SourceMapConsumer } from 'source-map';
import { TagInformation, offsetAt, positionAt } from '../../lib/documents';

export interface DocumentMapper {
    getOriginalPosition(generatedPosition: Position): Position;
    getGeneratedPosition(originalPosition: Position): Position;
}

export class IdentityMapper implements DocumentMapper {
    getOriginalPosition(generatedPosition: Position): Position {
        return generatedPosition;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        return originalPosition;
    }
}

export class FragmentMapper implements DocumentMapper {
    constructor(private originalText: string, private tagInfo: TagInformation) {}

    getOriginalPosition(generatedPosition: Position): Position {
        const parentOffset = this.offsetInParent(offsetAt(generatedPosition, this.tagInfo.content));
        return positionAt(parentOffset, this.originalText);
    }

    private offsetInParent(offset: number): number {
        return this.tagInfo.start + offset;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        const fragmentOffset = offsetAt(originalPosition, this.originalText) - this.tagInfo.start;
        return positionAt(fragmentOffset, this.originalText);
    }
}

export class ConsumerDocumentMapper implements DocumentMapper {
    consumer: SourceMapConsumer;
    sourceUri: string;

    constructor(consumer: SourceMapConsumer, sourceUri: string) {
        this.consumer = consumer;
        this.sourceUri = sourceUri;
    }

    getOriginalPosition(generatedPosition: Position): Position {
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

        return {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0,
        };
    }
}
