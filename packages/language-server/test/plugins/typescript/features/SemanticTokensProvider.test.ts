import path from 'path';
import ts from 'typescript';
import assert from 'assert';
import { Position, Range, SemanticTokensBuilder } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { TokenModifier, TokenType } from '../../../../src/lib/semanticToken/semanticTokenLegend';
import { LSConfigManager } from '../../../../src/ls-config';
import { SemanticTokensProviderImpl } from '../../../../src/plugins/typescript/features/SemanticTokensProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('SemanticTokensProvider', () => {
    function setup() {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const filePath = path.join(testDir, 'testfiles', 'semantic-tokens', 'tokens.svelte');
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const provider = new SemanticTokensProviderImpl(lsAndTsDocResolver);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath)
        });
        return { provider, document };
    }

    it('provides semantic token', async () => {
        const { provider, document } = setup();

        const { data } = (await provider.getSemanticTokens(document)) ?? {
            data: []
        };

        assertResult(data, getExpected(/* isFull */ true));
    });

    it('provides partial semantic token', async () => {
        const { provider, document } = setup();

        const { data } = (await provider.getSemanticTokens(
            document,
            Range.create(Position.create(0, 0), Position.create(9, 0))
        )) ?? {
            data: []
        };

        assertResult(data, getExpected(/* isFull */ false));
    });

    function getExpected(full: boolean) {
        const tokenDataScript: Array<{
            line: number;
            character: number;
            length: number;
            type: number;
            modifiers: number[];
        }> = [
            {
                line: 1,
                character: 14,
                length: 'TextContent'.length,
                type: TokenType.interface,
                modifiers: [TokenModifier.declaration]
            },
            {
                line: 2,
                character: 8,
                length: 'text'.length,
                type: TokenType.property,
                modifiers: [TokenModifier.declaration]
            },
            {
                line: 5,
                character: 15,
                length: 'textPromise'.length,
                type: TokenType.variable,
                modifiers: [TokenModifier.declaration, TokenModifier.local]
            },
            {
                line: 5,
                character: 28,
                length: 'Promise'.length,
                type: TokenType.interface,
                modifiers: [TokenModifier.defaultLibrary]
            },
            {
                line: 5,
                character: 36,
                length: 'TextContent'.length,
                type: TokenType.interface,
                modifiers: []
            },
            {
                line: 7,
                character: 19,
                length: 'blurHandler'.length,
                type: TokenType.function,
                modifiers: [TokenModifier.async, TokenModifier.declaration, TokenModifier.local]
            }
        ];
        const tokenDataAll = [
            ...tokenDataScript,
            {
                line: 10,
                character: 8,
                length: 'textPromise'.length,
                type: TokenType.variable,
                modifiers: [TokenModifier.local]
            },
            {
                line: 10,
                character: 25,
                length: 'text'.length,
                type: TokenType.parameter,
                modifiers: [TokenModifier.declaration]
            },
            {
                line: 11,
                character: 23,
                length: 'blurHandler'.length,
                type: TokenType.function,
                modifiers: [TokenModifier.async, TokenModifier.local]
            },
            {
                line: 11,
                character: 43,
                length: 'text'.length,
                type: TokenType.parameter,
                modifiers: []
            },
            {
                line: 11,
                character: 48,
                length: 'text'.length,
                type: TokenType.property,
                modifiers: []
            },
            {
                line: 13,
                character: 16,
                length: 1,
                type: TokenType.parameter,
                modifiers: [TokenModifier.declaration]
            },
            {
                line: 14,
                character: 5,
                length: 1,
                type: TokenType.parameter,
                modifiers: []
            }
        ];

        const builder = new SemanticTokensBuilder();
        for (const token of full ? tokenDataAll : tokenDataScript) {
            builder.push(
                token.line,
                token.character,
                token.length,
                token.type,
                token.modifiers.reduce((pre, next) => pre | (1 << next), 0)
            );
        }

        const data = builder.build().data;
        return data;
    }

    /**
     *  group result by tokens to better distinguish
     */
    function assertResult(actual: number[], expected: number[]) {
        const actualGrouped = group(actual);
        const expectedGrouped = group(expected);

        assert.deepStrictEqual(actualGrouped, expectedGrouped);
    }

    function group(tokens: number[]) {
        const result: number[][] = [];

        let index = 0;
        while (index < tokens.length) {
            result.push(tokens.splice(index, (index += 5)));
        }

        return result;
    }
});
