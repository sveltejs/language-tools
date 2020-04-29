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
    });
});
