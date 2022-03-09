import * as assert from 'assert';
import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver';
import { SvelteDocument } from '../../../../src/plugins/svelte/SvelteDocument';
import { Document } from '../../../../src/lib/documents';
import { getDocumentHighlight } from '../../../../src/plugins/svelte/features/getDocumentHighlight';

describe('SveltePlugin#getDocumentHighlight', () => {
    async function testSameHighlight(
        content: string,
        tests: number[],
        expected: Array<[start: number, end: number]>
    ) {
        const svelteDoc = createDoc(content);

        for (const position of tests) {
            await testOne(svelteDoc, position, expected);
        }
    }

    function createDoc(content: string) {
        return new SvelteDocument(new Document('url', content));
    }

    async function testOne(
        svelteDoc: SvelteDocument,
        character: number,
        expected: Array<[start: number, end: number]> | null
    ) {
        const documentHighlight = await getDocumentHighlight(svelteDoc, { line: 0, character });

        assert.deepStrictEqual(
            documentHighlight?.sort((a, b) => a.range.start.character - b.range.start.character),
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
        await testOne(createDoc('<style></style>'), 7, null);
        await testOne(createDoc('<script></script>'), 8, null);
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
        await testOne(createDoc('{#if expression}{:else if hi}{#if hi}{/if}{/if}'), 2, [
            [1, 4],
            [17, 25],
            [43, 46]
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
            '{#await expression then name}{/await}',
            [2, 20, 30],
            [
                [1, 7],
                [19, 23],
                [30, 36]
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
        await testOne(createDoc('{@debug name}'), 2, [[1, 7]]);
    });

    it('get highlight for html tag', async () => {
        await testOne(createDoc('{@html name}'), 2, [[1, 6]]);
    });

    it('get highlight for const tag', async () => {
        await testOne(createDoc('{#each expression as item}{@const name = item}{/each}'), 28, [
            [27, 33]
        ]);
    });
});
