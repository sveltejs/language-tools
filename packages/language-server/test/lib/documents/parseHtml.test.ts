import assert from 'assert';
import { parseHtml } from '../../../src/lib/documents/parseHtml';

describe('parseHtml', () => {
    it('ignore html end-tag-like inside moustache', () => {
        const { roots } = parseHtml(
            `<Foo on:click={() => console.log('ya!!!')} />
            <style></style>`
        );

        assert.deepStrictEqual(roots.map(r => r.tag), [
            'Foo',
            'style'
        ]);
    });
});
