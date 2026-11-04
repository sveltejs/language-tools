import { describe, expect, it } from 'vitest';
import {
    findStoreBindingOffset,
    findStoreUsageOffsets,
    getIdentifierAt,
    getStoreAccessAt
} from '../src/typescript-go/middleware/storeText';

const at = (text: string, needle: string, delta = 0) => text.indexOf(needle) + delta;

describe('getStoreAccessAt', () => {
    const text = `<script>let a = $store + $$props.x + $state(1) + obj.$foo + $store2;</script>`;

    it('finds store accesses', () => {
        expect(getStoreAccessAt(text, at(text, '$store', 3))).toEqual({
            name: 'store',
            start: at(text, '$store'),
            end: at(text, '$store') + 6
        });
        expect(getStoreAccessAt(text, at(text, '$store2', 0))?.name).toBe('store2');
    });

    it('ignores $$props, runes and property accesses', () => {
        expect(getStoreAccessAt(text, at(text, '$$props', 3))).toBeUndefined();
        expect(getStoreAccessAt(text, at(text, '$state', 2))).toBeUndefined();
        expect(getStoreAccessAt(text, at(text, '$foo', 2))).toBeUndefined();
        expect(getStoreAccessAt(text, at(text, 'let', 1))).toBeUndefined();
    });
});

describe('getIdentifierAt', () => {
    it('returns plain identifiers only', () => {
        const text = 'const store = $store;';
        expect(getIdentifierAt(text, at(text, 'store', 2))).toBe('store');
        expect(getIdentifierAt(text, at(text, '$store', 2))).toBeUndefined();
    });
});

describe('findStoreUsageOffsets', () => {
    it('finds $name occurrences outside of comments', () => {
        const text = `<script>
    // $store in a comment
    $store = 1; $stores; obj.$store;
</script>
{$store} <!-- $store -->`;
        expect(findStoreUsageOffsets(text, 'store')).toEqual([
            at(text, '$store = 1'),
            at(text, '{$store}') + 1
        ]);
    });
});

describe('findStoreBindingOffset', () => {
    const cases: Array<[string, string, string]> = [
        ['const', `<script>\n\tconst store = writable(1);\n</script>`, 'store ='],
        ['let', `<script>\n\tlet store = writable(1);\n</script>`, 'store ='],
        ['export let', `<script>\n\texport let store;\n</script>`, 'store;'],
        ['named import', `<script>\n\timport { a, store } from './stores';\n</script>`, 'store }'],
        [
            'aliased import',
            `<script>\n\timport { count as store } from './stores';\n</script>`,
            'store }'
        ],
        ['default import', `<script>\n\timport store from './stores';\n</script>`, 'store from'],
        [
            'namespace import',
            `<script>\n\timport * as store from './stores';\n</script>`,
            'store from'
        ],
        [
            'module script',
            `<script module>\n\texport const store = writable(1);\n</script>\n<script>\n\t$store;\n</script>`,
            'store ='
        ]
    ];
    for (const [title, text, needle] of cases) {
        it(title, () => {
            expect(findStoreBindingOffset(text, 'store')).toBe(at(text, needle));
        });
    }

    it('ignores the imported name of an aliased import and comments', () => {
        const text = `<script>\n\t// const store = 1\n\timport { store as other } from './stores';\n</script>`;
        expect(findStoreBindingOffset(text, 'store')).toBeUndefined();
        expect(findStoreBindingOffset(text, 'other')).toBe(at(text, 'other'));
    });
});
