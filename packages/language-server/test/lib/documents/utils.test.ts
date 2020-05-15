import * as assert from 'assert';
import { extractTag } from '../../../src/lib/documents/utils';
import { Position } from 'vscode-languageserver';

describe('document/utils', () => {
    describe('extractTag', () => {
        it('does not extract style tag inside comment', () => {
            const text = `
                <p>bla</p>
                <!--<style>h1{ color: blue; }</style>-->
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractTag(text, 'style'), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 108,
                end: 125,
                startPos: Position.create(3, 23),
                endPos: Position.create(3, 40),
                container: { start: 101, end: 133 },
            });
        });

        it('does not extract tags starting with style/script', () => {
            // https://github.com/sveltejs/language-tools/issues/43
            // this would previously match <styles>....</style> due to misconfigured attribute matching regex
            const text = `
            <styles>p{ color: blue; }</styles>
            <p>bla</p>
            ></style>
            `;
            assert.deepStrictEqual(extractTag(text, 'style'), null);
        });

        it('only extract attribute until tag ends', () => {
            const text = `
            <script type="typescript">
            () => abc
            </script>
            `;
            const extracted = extractTag(text, 'script');
            const attributes = extracted?.attributes;
            assert.deepStrictEqual(attributes, { type: 'typescript' });
        });

        it('extracts style tag', () => {
            const text = `
                <p>bla</p>
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractTag(text, 'style'), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 51,
                end: 68,
                startPos: Position.create(2, 23),
                endPos: Position.create(2, 40),
                container: { start: 44, end: 76 },
            });
        });

        it('extracts style tag with attributes', () => {
            const text = `
                <style lang="scss">p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractTag(text, 'style'), {
                content: 'p{ color: blue; }',
                attributes: { lang: 'scss' },
                start: 36,
                end: 53,
                startPos: Position.create(1, 35),
                endPos: Position.create(1, 52),
                container: { start: 17, end: 61 },
            });
        });

        it('extracts style tag with attributes and extra whitespace', () => {
            const text = `
                <style     lang="scss"    >  p{ color: blue; }  </style>
            `;
            assert.deepStrictEqual(extractTag(text, 'style'), {
                content: '  p{ color: blue; }  ',
                attributes: { lang: 'scss' },
                start: 44,
                end: 65,
                startPos: Position.create(1, 43),
                endPos: Position.create(1, 64),
                container: { start: 17, end: 73 },
            });
        });
        it('extracts top level script tag only', () => {
            const text = `
                {#if name}
                    <script>
                        console.log('not top level')
                    </script>
                {/if}
                <ul>
                    {#each cats as cat}
                        <script>
                            console.log('not top level')
                        </script>
                    {/each}
                </ul>
                {#await promise}
                    <script>
                        console.log('not top level')
                    </script>
                {:then number}
                    <script>
                        console.log('not top level')
                    </script>
                {:catch error}
                    <script>
                        console.log('not top level')
                    </script>
                {/await}
                <p>{@html <script> consolelog('not top level')</script>}</p>
                <!-- p{ color: blue; }</script> -->
                <!--<script lang="scss">
                p{ color: blue; }
                </script> -->
                <scrit>blah</script>
                <script>top level script</script>
            `;
            assert.deepStrictEqual(extractTag(text, 'script'), {
                content: 'top level script',
                attributes: {},
                start: 1148,
                end: 1164,
                startPos: Position.create(32, 24),
                endPos: Position.create(32, 40),
                container: { start: 1140, end: 1173 },
            });
        });
    });
});
