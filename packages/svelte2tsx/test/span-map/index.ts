import assert from 'assert';
import path from 'path';
import { VERSION } from 'svelte/compiler';
import { svelte2tsx } from '../build';
import { each_sample, get_svelte2tsx_config } from '../helpers';
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
});

describe('span map merges', function () {
    it('maps a binding that follows an ignored character to itself', () => {
        // The character before `bind:` is overwritten and ignored. The binding name must not
        // extend the mapping that comes before it in the generated code (the `/` of `/>`).
        for (const input of [
            '<input\n\tbind:checked={checked}\n/>\n\n<p>text after the element</p>',
            '<svelte:window\n\tbind:innerWidth={width} />'
        ]) {
            const { code, spanMappings } = svelte2tsx(input, {
                version: VERSION,
                generateSpanMapping: true
            });
            const start = input.indexOf('bind:');
            const name = input.slice(start, input.indexOf('=', start));
            const mappings = spanMappings
                .filter(([, , originalStart]) => originalStart === start)
                .map(([virtualStart, virtualLength, , originalLength]) => ({
                    text: code.slice(virtualStart, virtualStart + virtualLength),
                    originalLength
                }));
            assert.ok(
                mappings.some(
                    ({ text, originalLength }) => text === name && originalLength === name.length
                ),
                `${name} doesn't map to itself: ${JSON.stringify(mappings)}`
            );
        }
    });
});
