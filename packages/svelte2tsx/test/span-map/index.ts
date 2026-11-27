import assert from 'assert';
import path from 'path';
import { VERSION } from 'svelte/compiler';
import { svelte2tsx } from '../build';
import { each_sample, get_svelte2tsx_config } from '../helpers';
import { SpanMapKind, validateSpanMap } from '../../src/utils/spanMap';
import { assertDirectivesCoverIgnoreRegions, assertValidSpanMap } from './check';

const isSvelte5Plus = Number(VERSION[0]) >= 5;

/**
 * The span maps and directives of content mapper mode (`generateSpanMapping`) for all svelte2tsx
 * samples. The output itself is covered by the samples' tests, the span maps of a few samples by
 * the `span_mapping.txt` snapshots of the sourcemaps tests.
 */
describe('span maps', function () {
    for (const dir of ['svelte2tsx', 'sourcemaps']) {
        for (const sample of each_sample(path.join(__dirname, '..', dir))) {
            if (sample.name.endsWith('.v5') && !isSvelte5Plus) continue;
            const svelteFile = sample.find_file('*.svelte');
            const config = {
                ...get_svelte2tsx_config(
                    {
                        filename: svelteFile,
                        emitOnTemplateError: sample.emitOnTemplateError
                    },
                    sample.name
                ),
                ...JSON.parse(sample.get('config.json') || '{}')
            };
            if (config.mode === 'dts' || sample.has('expected.error.json')) continue;

            it(`${dir}/${sample.name}${sample.emitOnTemplateError ? ' (loose)' : ''}`, () => {
                const input = sample.get(svelteFile);
                const plain = svelte2tsx(input, config);
                const result = svelte2tsx(input, { ...config, generateSpanMapping: true });

                assertValidSpanMap(input, result as any);
                assertDirectivesCoverIgnoreRegions(
                    result.code,
                    result.diagnosticDirectives?.directives
                );
                if (result.code === plain.code) {
                    // the source map is adjusted for the removed markers
                    assert.strictEqual(result.map.mappings, plain.map.mappings);
                }
            });
        }
    }

    it('maps removed text that starts with an emoji to the whole emoji', () => {
        const input = '<span>👍 text</span>';
        const { spanMappings } = svelte2tsx(input, { version: VERSION, generateSpanMapping: true });
        const start = input.indexOf('👍');
        const mapping = spanMappings.find(([, , originalStart]) => originalStart === start);
        assert.deepStrictEqual(mapping?.slice(1, 5), [1, start, 2, SpanMapKind.Atom]);
    });

    it('rejects a segment that ends inside a surrogate pair', () => {
        const [issue] = validateSpanMap('👍', ' ', [[0, 1, 0, 1, SpanMapKind.Atom]]);
        assert.match(issue, /splits a surrogate pair/);
    });
});

describe('span maps: attribute names', () => {
    it('keeps one-character attribute names verbatim (completions at `<Child v|`)', () => {
        const input = '<script lang="ts">import Child from "./Child.svelte";</script>\n<Child v />';
        const result = svelte2tsx(input, {
            filename: 'Input.svelte',
            isTsFile: true,
            mode: 'ts',
            generateSpanMapping: true
        }) as any;
        const nameStart = input.indexOf(' v ') + 1;
        // 0: virtual start, 1: virtual length, 2: original start, 3: original length, 4: kind
        const mapping = result.spanMappings.find((m: number[]) => m[2] === nameStart && m[3] === 1);
        assert.ok(mapping, 'the name is mapped');
        assert.strictEqual(mapping[4], 0, 'Verbatim');
        assert.strictEqual(result.code.slice(mapping[0] - 1, mapping[0] + 2), '"v"');
    });
});
