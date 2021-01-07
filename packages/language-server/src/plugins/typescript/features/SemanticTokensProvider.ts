import ts from 'typescript';
import {
    Range,
    SemanticTokens,
    SemanticTokensBuilder
} from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { SemanticTokensProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToTextSpan } from '../utils';

export class SemanticTokensProviderImpl implements SemanticTokensProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getSemanticTokens(textDocument: Document, range?: Range): Promise<SemanticTokens> {
        const { lang, tsDoc } = this.lsAndTsDocResolver.getLSAndTSDoc(textDocument);
        const fragment = await tsDoc.getFragment();
        const textSpan = range
            ? convertToTextSpan(range, fragment)
            : {
                  start: 0,
                  length: fragment.text.length
              };

        const { spans } = lang.getEncodedSemanticClassifications(
            tsDoc.filePath,
            textSpan,
            ts.SemanticClassificationFormat.TwentyTwenty
        );

        const builder = new SemanticTokensBuilder();
        let index = 0;

        while (index < spans.length) {
            // [start, length, encodedClassification, start2, length2, encodedClassification2]
            const generatedOffset = spans[index++];
            const generatedLength = spans[index++];
            const encodedClassification = spans[index++];
            const classificationType = this.getTokenTypeFromClassification(encodedClassification);
            if (classificationType < 0) {
                continue;
            }

            const originalPosition = this.mapToOrigin(
                textDocument,
                fragment,
                generatedOffset,
                generatedLength
            );
            if (!originalPosition) {
                continue;
            }
            const [line, character, length] = originalPosition;
            const modifier = this.getTokenModifierFromClassification(encodedClassification);

            builder.push(line, character, length, classificationType , modifier);
        }

        return builder.build();
    }

    private mapToOrigin(
        document: Document,
        fragment: SnapshotFragment,
        generatedOffset: number,
        generatedLength: number
    ): [line: number, character: number, length: number] | undefined {
        const startPosition = fragment.getOriginalPosition(fragment.positionAt(generatedOffset));

        if (startPosition.line < 0) {
            return;
        }

        const endPosition = fragment.getOriginalPosition(
            fragment.positionAt(generatedOffset + generatedLength)
        );
        const startOffset = document.offsetAt(startPosition);
        const endOffset = document.offsetAt(endPosition);

        return [startPosition.line, startPosition.character, endOffset - startOffset];
    }

    /** TSClassification =
     *  (TokenType + 1) << TokenEncodingConsts.typeOffset + TokenModifier */
    private getTokenTypeFromClassification(tsClassification: number): number {
        return (tsClassification >> TokenEncodingConsts.typeOffset) - 1;
    }

    private getTokenModifierFromClassification(tsClassification: number) {
        return tsClassification & TokenEncodingConsts.modifierMask;
    }
}

const enum TokenEncodingConsts {
    typeOffset = 8,
    modifierMask = (1 << typeOffset) - 1
}
