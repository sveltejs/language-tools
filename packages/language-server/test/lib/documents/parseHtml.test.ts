import assert from 'assert';
import { parseHtml } from '../../../src/lib/documents/parseHtml';

describe('parseHtml', () => {
    it('ignore arrow inside moustache', () => {
        const { roots } = parseHtml(
            `<Foo on:click={() => console.log('ya!!!')} />
            <style></style>`
        );

        assert.deepStrictEqual(roots.map(r => r.tag), [
            'Foo',
            'style'
        ]);
    });

    it('ignore bigger than inside moustache', () => {
        const { roots } = parseHtml(
            `<Foo checked={a > 1} />
            <style></style>`
        );

        assert.deepStrictEqual(roots.map(r => r.tag), [
            'Foo',
            'style'
        ]);
    });
});
