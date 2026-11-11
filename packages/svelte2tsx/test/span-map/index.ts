import assert from 'assert';
import path from 'path';
import { VERSION } from 'svelte/compiler';
import { svelte2tsx } from '../build';
import { each_sample, get_svelte2tsx_config } from '../helpers';
import {
    assertDirectivesCoverIgnoreRegions,
    assertValidSpanMap,
    formatGapRatio,
    GapRatio,
    getGapRatio
} from './check';

const isSvelte5Plus = Number(VERSION[0]) >= 5;

/**
 * The span maps and directives of content mapper mode (`generateSpanMapping`) for all svelte2tsx
 * samples. The output itself is covered by the samples' tests, the span maps of a few samples by
 * the `span_mapping.txt` snapshots of the sourcemaps tests.
 */
describe('span maps', function () {
    const total: GapRatio = { total: 0, unmapped: 0, unmappedOutsideIgnore: 0 };

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

                assertValidSpanMap(input, result);
                assertDirectivesCoverIgnoreRegions(
                    result.code,
                    result.diagnosticDirectives?.directives
                );
                if (result.code === plain.code) {
                    // the source map is adjusted for the removed markers
                    assert.strictEqual(result.map.mappings, plain.map.mappings);
                }

                const ratio = getGapRatio(
                    result.code,
                    result.spanMappings,
                    result.diagnosticDirectives?.directives
                );
                total.total += ratio.total;
                total.unmapped += ratio.unmapped;
                total.unmappedOutsideIgnore += ratio.unmappedOutsideIgnore;

                // what the content mapper uses for projects that emit declarations
                const forDeclarations = svelte2tsx(input, {
                    ...config,
                    generateSpanMapping: true,
                    declarationEmit: true
                });
                assertValidSpanMap(input, forDeclarations);
                assertDirectivesCoverIgnoreRegions(
                    forDeclarations.code,
                    forDeclarations.diagnosticDirectives?.directives
                );
            });
        }
    }

    after(() => {
        if (process.env.SPAN_MAP_GAP_RATIO) {
            console.log(`  span maps, all samples: ${formatGapRatio(total)}`);
        }
    });
});
