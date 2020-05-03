import * as assert from 'assert';
import { extractTag } from '../../../src/lib/documents/utils';

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
                container: { start: 101, end: 133 },
            });
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
                container: { start: 44, end: 76 },
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
    });
});
