import { describe, expect, it } from 'vitest';
import { filterGeneratedCompletions } from '../src/typescript-go/middleware/completions';

describe('filterGeneratedCompletions', () => {
    // labels as returned by TS7 + content mapper for a `{v|}` template expression
    const labels = [
        'value',
        'x',
        '$$render',
        'Complete__SvelteComponent_',
        '__sveltets_2_any',
        '__sveltets_$$bindings',
        '$$_abc',
        '$$ComponentProps',
        'svelteHTML',
        'svelteNative',
        'SvelteStore',
        '$$props',
        '$state',
        'parseInt'
    ];
    const kept = ['value', 'x', '$$props', '$state', 'parseInt'];

    it('filters completion lists', () => {
        const result = filterGeneratedCompletions({
            isIncomplete: false,
            items: labels.map((label) => ({ label }))
        });
        expect(result?.items.map((i) => i.label)).toEqual(kept);
        expect(result?.isIncomplete).toBe(false);
    });

    it('filters completion arrays', () => {
        const result = filterGeneratedCompletions(labels.map((label) => ({ label })));
        expect(result?.map((i) => i.label)).toEqual(kept);
    });

    it('handles null', () => {
        expect(filterGeneratedCompletions(null)).toBe(null);
    });
});
