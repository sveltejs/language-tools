import { getLineOffsets, positionAt } from '../../lib/documents';
import type { tsAst } from './types';

export class SvelteTsSourceFileDocument {
    private readonly sourceFile: tsAst.SourceFile;
    private originalCodeLineOffsets: number[] | undefined;

    constructor(sourceFile: tsAst.SourceFile) {
        this.sourceFile = sourceFile;
    }

    private getOriginalLineOffsets() {
        if (!this.originalCodeLineOffsets) {
            this.originalCodeLineOffsets = getLineOffsets(this.sourceFile.originalText);
        }
        return this.originalCodeLineOffsets;
    }

    originPositionAt(originOffset: number) {
        return positionAt(
            originOffset,
            this.sourceFile.originalText,
            this.getOriginalLineOffsets()
        );
    }
}
