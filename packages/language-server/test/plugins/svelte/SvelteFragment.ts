import * as assert from 'assert';
import { TextDocument } from '../../../src/lib/documents/TextDocument';
import { SvelteFragment, SvelteFragmentDetails } from '../../../src/plugins/svelte/SvelteDocument';

describe('SvelteFragment', () => {
    function createDetails(start: number, end: number): SvelteFragmentDetails {
        // SvelteFragment only needs start/end
        return <any>{ start, end };
    }

    it('isInFragment works', () => {
        const parent = new TextDocument('file:///hello.svelte', 'Hello, \nworld!');
        const fragment = new SvelteFragment(parent, createDetails(8, 13));

        assert.strictEqual(fragment.isInFragment({ line: 0, character: 0 }), false);
        assert.strictEqual(fragment.isInFragment({ line: 1, character: 0 }), true);
        assert.strictEqual(fragment.isInFragment({ line: 1, character: 5 }), true);
        assert.strictEqual(fragment.isInFragment({ line: 1, character: 6 }), false);
    });

    it('calculates the offset in parent', () => {
        const parent = new TextDocument('file:///hello.svelte', 'Hello, world!');
        const fragment = new SvelteFragment(parent, createDetails(7, 12));

        assert.strictEqual(fragment.offsetInParent(2), 9);
    });

    it('calculates the position in parent', () => {
        const parent = new TextDocument('file:///hello.svelte', 'Hello, \nworld!');
        const fragment = new SvelteFragment(parent, createDetails(8, 13));

        assert.deepStrictEqual(fragment.positionInParent({ line: 0, character: 2 }), {
            line: 1,
            character: 2,
        });
    });

    it('calculates the position in fragment', () => {
        const parent = new TextDocument('file:///hello.svelte', 'Hello, \nworld!');
        const fragment = new SvelteFragment(parent, createDetails(8, 13));

        assert.deepStrictEqual(fragment.positionInFragment({ line: 1, character: 2 }), {
            line: 0,
            character: 2,
        });
    });
});
