import assert from 'assert';

/**
 * Checks what TypeScript 7 checks for a content mapper's span map and diagnostic directives
 * (independent of svelte2tsx's own validation):
 * - segments sorted, non-overlapping, non-empty and in bounds; `Verbatim` text identical on both sides
 * - directives in bounds, sorted and non-overlapping, only `Ignore` (svelte2tsx doesn't create others)
 * - no marker comments left in the output
 */
export function assertValidSpanMap(
    original: string,
    result: {
        code: string;
        spanMappings: SpanMapping[];
        diagnosticDirectives?: { directives: Directive[] };
        spanMapIssues?: string[];
    }
) {
    const { code, spanMappings } = result;
    assert.deepStrictEqual(result.spanMapIssues, undefined, 'svelte2tsx dropped invalid parts');
    assert.ok(!/\/\*Ω+#\d+Ω\*\//.test(code), 'span map markers must be stripped');

    let previousEnd = 0;
    for (const mapping of spanMappings) {
        const [virtualStart, virtualLength, originalStart, originalLength, kind, features] =
            mapping;
        const message = `invalid segment ${JSON.stringify(mapping)}`;
        assert.ok(
            [virtualStart, virtualLength, originalStart, originalLength].every(
                (n) => Number.isInteger(n) && n >= 0
            ),
            message
        );
        assert.ok(virtualLength > 0, `${message}: empty`);
        assert.ok(virtualStart >= previousEnd, `${message}: unsorted or overlapping`);
        assert.ok(virtualStart + virtualLength <= code.length, `${message}: out of bounds`);
        assert.ok(originalStart + originalLength <= original.length, `${message}: out of bounds`);
        assert.ok([0, 1, 2].includes(kind), `${message}: kind`);
        assert.ok(
            features === undefined || (features >= 0 && features < 1 << 20),
            `${message}: features`
        );
        if (kind === 0) {
            assert.strictEqual(
                code.slice(virtualStart, virtualStart + virtualLength),
                original.slice(originalStart, originalStart + originalLength),
                'Verbatim spans must have the same generated and original text'
            );
        }
        previousEnd = virtualStart + virtualLength;
    }

    previousEnd = 0;
    for (const directive of result.diagnosticDirectives?.directives ?? []) {
        const [originalStart, originalLength, virtualStart, virtualEnd, policy, index] = directive;
        const message = `invalid directive ${JSON.stringify(directive)}`;
        assert.ok(
            [originalStart, originalLength, virtualStart, virtualEnd].every(
                (n) => Number.isInteger(n) && n >= 0
            ),
            message
        );
        assert.ok(originalStart + originalLength <= original.length, `${message}: out of bounds`);
        assert.ok(virtualStart < virtualEnd && virtualEnd <= code.length, `${message}: range`);
        assert.ok(virtualStart >= previousEnd, `${message}: unsorted or overlapping`);
        assert.strictEqual(policy, 0, `${message}: policy`);
        assert.strictEqual(index, undefined, `${message}: index`);
        previousEnd = virtualEnd;
    }
}

const IGNORE_END = '/*Ωignore_endΩ*/';

/**
 * Each position inside an ignore region (TS6's `isInGeneratedCode`, outermost regions) is
 * covered by an `Ignore` directive, except for the arguments of `__sveltets_2_store_get(x)`,
 * whose diagnostics the language server post-processes. Nothing outside is covered.
 */
export function assertDirectivesCoverIgnoreRegions(
    code: string,
    directives: Directive[] | undefined
) {
    const expected = new Uint8Array(code.length);
    let depth = 0;
    let start = 0;
    for (const match of code.matchAll(/\/\*Ωignore_(start|end)Ω\*\//g)) {
        if (match[1] === 'start') {
            if (depth++ === 0) start = match.index;
        } else if (depth > 0 && --depth === 0) {
            expected.fill(1, start, match.index + IGNORE_END.length);
        }
    }
    for (const match of code.matchAll(/__sveltets_2_store_get\(([^)]*)\)/g)) {
        const argumentStart = match.index + '__sveltets_2_store_get('.length;
        expected.fill(0, argumentStart, argumentStart + match[1].length);
    }

    const actual = new Uint8Array(code.length);
    for (const [, , virtualStart, virtualEnd] of directives ?? []) {
        actual.fill(1, virtualStart, virtualEnd);
    }
    for (let i = 0; i < code.length; i++) {
        if (actual[i] !== expected[i]) {
            assert.fail(
                `position ${i} ${expected[i] ? 'should' : 'should not'} be ignored: ` +
                    JSON.stringify(
                        code.slice(Math.max(0, i - 40), i) + '⟨⟩' + code.slice(i, i + 40)
                    )
            );
        }
    }
}

type SpanMapping = [number, number, number, number, number, number?];
type Directive = [number, number, number, number, number, number?];
