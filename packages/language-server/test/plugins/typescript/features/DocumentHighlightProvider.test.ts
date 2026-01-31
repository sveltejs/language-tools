import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../src/plugins';
import { DocumentHighlightProviderImpl } from '../../../../src/plugins/typescript/features/DocumentHighlightProvider';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');

describe('DocumentHighlightProvider', function () {
    const highlightTestDir = path.join(testDir, 'testfiles', 'document-highlight');
    serviceWarmup(this, highlightTestDir);

    function getFullPath(filename: string) {
        return path.join(highlightTestDir, filename);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [testDir],
            new LSConfigManager()
        );
        const provider = new DocumentHighlightProviderImpl(lsAndTsDocResolver);
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument({
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { provider, document };
    }

    it('find document highlight', async () => {
        const { document, provider } = setup('document-highlight.svelte');

        const highlight = await provider.findDocumentHighlight(document, {
            line: 1,
            character: 9
        });

        assert.deepStrictEqual(highlight, <DocumentHighlight[]>[
            {
                range: {
                    start: {
                        line: 1,
                        character: 8
                    },
                    end: {
                        line: 1,
                        character: 12
                    }
                },
                kind: DocumentHighlightKind.Write
            },
            {
                range: {
                    start: {
                        line: 3,
                        character: 8
                    },
                    end: {
                        line: 3,
                        character: 12
                    }
                },
                kind: DocumentHighlightKind.Read
            },
            {
                range: {
                    start: {
                        line: 8,
                        character: 1
                    },
                    end: {
                        line: 8,
                        character: 5
                    }
                },
                kind: DocumentHighlightKind.Read
            }
        ]);
    });

    describe('DocumentHighlightProvider (svelte blocks/tags)', () => {
        async function testSameHighlight(
            content: string,
            tests: number[],
            expected: Array<[start: number, end: number]>
        ) {
            const { provider, document } = setup(content);

            for (const position of tests) {
                await testOne(document, provider, position, expected);
            }
        }

        function setup(content: string) {
            const docManager = new DocumentManager(
                (textDocument) => new Document(textDocument.uri, textDocument.text)
            );
            const lsAndTsDocResolver = new LSAndTSDocResolver(
                docManager,
                [testDir],
                new LSConfigManager()
            );
            const provider = new DocumentHighlightProviderImpl(lsAndTsDocResolver);
            const filePath = getFullPath(`svelte.virtual${Math.random().toFixed(16)}.svelte`);
            const document = docManager.openClientDocument({
                uri: pathToUrl(filePath),
                text: content
            });
            return { provider, document };
        }

        async function testOne(
            document: Document,
            provider: DocumentHighlightProviderImpl,
            character: number,
            expected: Array<[start: number, end: number]> | null
        ) {
            const documentHighlight = await provider.findDocumentHighlight(document, {
                line: 0,
                character
            });

            assert.deepStrictEqual(
                documentHighlight?.sort(
                    (a, b) => a.range.start.character - b.range.start.character
                ),
                expected?.map(
                    ([start, end]): DocumentHighlight => ({
                        kind: DocumentHighlightKind.Read,
                        range: {
                            start: { line: 0, character: start },
                            end: { line: 0, character: end }
                        }
                    })
                )
            );
        }

        it('should return null for style and script', async () => {
            const { provider, document } = setup('<style></style><script></script>');
            await testOne(document, provider, 7, null);
            await testOne(document, provider, 15, null);
        });

        it('get highlight for key block', async () => {
            await testSameHighlight(
                '{#key foo}{/key}',
                [2, 12],
                [
                    [1, 5],
                    [11, 15]
                ]
            );
        });

        it('get highlight for each block', async () => {
            await testSameHighlight(
                '{#each expression as name}{:else}{/each}',
                [2, 28, 35],
                [
                    [1, 6],
                    [27, 32],
                    [34, 39]
                ]
            );
        });

        it('get highlight for if block', async () => {
            await testSameHighlight(
                '{#if expression}{:else}{/if}',
                [2, 18, 25],
                [
                    [1, 4],
                    [17, 22],
                    [24, 27]
                ]
            );
        });

        it('get highlight for if block with else if', async () => {
            await testSameHighlight(
                '{#if expression}{:else if foo}{:else}{/if}',
                [2, 18, 32, 39],
                [
                    [1, 4],
                    [17, 25],
                    [31, 36],
                    [38, 41]
                ]
            );
        });

        it("doesn't get highlights from another if block nested inside", async () => {
            const { provider, document } = setup('{#if expression}{:else if hi}{#if hi}{/if}{/if}');
            await testOne(document, provider, 2, [
                [1, 4],
                [17, 25],
                [43, 46]
            ]);
        });

        it('highlight nested if block', async () => {
            const { provider, document } = setup('{#if expression}{:else if hi}{#if hi}{/if}{/if}');
            await testOne(document, provider, 31, [
                [30, 33],
                [38, 41]
            ]);
        });

        it('get highlight for await block', async () => {
            await testSameHighlight(
                '{#await expression}{:then name}{:catch name}{/await}',
                [2, 21, 33, 46],
                [
                    [1, 7],
                    [20, 25],
                    [32, 38],
                    [45, 51]
                ]
            );
        });

        it('get highlight for await block (skip pending)', async () => {
            await testSameHighlight(
                '{#await expression then name} {/await}',
                [2, 20, 31],
                [
                    [1, 7],
                    [19, 23],
                    [31, 37]
                ]
            );
        });

        it('get highlight for await block (skip pending and then)', async () => {
            await testSameHighlight(
                '{#await expression catch name}{/await}',
                [2, 20, 31],
                [
                    [1, 7],
                    [19, 24],
                    [31, 37]
                ]
            );
        });

        it('get highlight for debug tag', async () => {
            const { provider, document } = setup('{@debug name}');
            await testOne(document, provider, 2, [[1, 7]]);
        });

        it('get highlight for html tag', async () => {
            const { provider, document } = setup('{@html name}');
            await testOne(document, provider, 2, [[1, 6]]);
        });

        it('get highlight for const tag', async () => {
            const { provider, document } = setup(
                '{#each expression as item}{@const name = item}{/each}'
            );
            await testOne(document, provider, 28, [[27, 33]]);
        });
    });
});
