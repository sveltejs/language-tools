import ts from 'typescript';
import { Range, SemanticTokens, SemanticTokensBuilder } from 'vscode-languageserver';
import { Document, offsetAt } from '../../../lib/documents';
import { SemanticTokensProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToTextSpan } from '../utils';
import { isSvelte2tsxGeneratedIdentifer } from './utils';

export class SemanticTokensProviderImpl implements SemanticTokensProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getSemanticTokens(textDocument: Document, range?: Range): Promise<SemanticTokens> {
        const { lang, tsDoc } = this.lsAndTsDocResolver.getLSAndTSDoc(textDocument);
        const fragment = await tsDoc.getFragment();
        const textSpan = range
            ? convertToTextSpan(range, fragment)
            : {
                  start: 0,
                  length: tsDoc.parserError
                      ? fragment.text.length
                      : // This is appended by svelte2tsx, there's nothing mappable afterwards
                        fragment.text.lastIndexOf('return { props:') || fragment.text.length
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
            const identifierText = fragment.text.substr(generatedOffset, generatedLength);
            if (isSvelte2tsxGeneratedIdentifer(identifierText)) {
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

            // remove generated identifier
            if (!length) {
                continue;
            }

            const modifier = this.getTokenModifierFromClassification(encodedClassification);

            builder.push(line, character, length, classificationType, modifier);
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

        const generatedEndOffset = generatedOffset + generatedLength;
        const startOffset = document.offsetAt(startPosition);
        const generatedEndPosition = fragment.positionAt(generatedEndOffset);
        const endPosition = fragment.getOriginalPositionOfEndOfChar
            ? fragment.getOriginalPositionOfEndOfChar(generatedEndPosition)
            : fragment.getGeneratedPosition(generatedEndPosition);

        if (endPosition.line < 0) {
            return;
        }
        const endOffset = offsetAt(endPosition, document.getText());

        return [startPosition.line, startPosition.character, endOffset - startOffset];
    }

    /**
     *  TSClassification = (TokenType + 1) << TokenEncodingConsts.typeOffset + TokenModifier
     */
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
