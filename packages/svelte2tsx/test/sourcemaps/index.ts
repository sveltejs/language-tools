import assert from 'assert';
import svelte2tsx from '../build';
import { each_sample } from '../helpers';
import { decode } from 'sourcemap-codec';
import { print_mappings, test_sample_result } from './parser';

describe('sourcemaps', function () {
    for (const sample of each_sample(__dirname)) {
        sample.check({
            required: ['*.svelte'],
            allowed: ['output.tsx', 'mappings.jsx', 'test.html']
        });
        const svelteFile = sample.folder.find((f) => f.endsWith('.svelte'));

        const shouldGenerate = !process.env.CI && !sample.has('mappings.jsx');

        sample.it(function () {
            const original = { code: sample.get(svelteFile) };
            const generated = svelte2tsx(original.code, {
                strictMode: sample.name.includes('strictMode'),
                isTsFile: sample.name.startsWith('ts-'),
                filename: svelteFile
            });

            generated.map.file = 'output.tsx';
            generated.map.sources = [svelteFile];
            generated.map.sourcesContent = [original.code];

            const decoded = decode(generated.map.mappings) as any;

            const mappings = {
                expected: sample.get('mappings.jsx'),
                actual: print_mappings(original.code, generated.code, decoded).replace(/\s*$/, '')
            };

            if (sample.has('test.html')) {
                test_sample_result(original.code, generated.code, sample.get('test.html'), decoded);
            }

            if (mappings.expected === mappings.actual && !shouldGenerate) return;

            if (process.env.CI) {
                assert(sample.has('mappings.jsx'), `Forgot to generate expected sample results`);
                assert.fail(`Source Mappings changed, run tests locally to re-generate results.`);
            } else {
                if (!shouldGenerate) {
                    sample.generate(
                        'output.tsx',
                        `${generated.code}\n//# sourceMappingURL=${generated.map.toUrl()}`,
                        false
                    );
                    after(() =>
                        console.log(
                            `SourceMapping Changed at "${sample.name}"\n\n` +
                                `Visualize the output in details by opening "output.tsx" on https://evanw.github.io/source-map-visualization/\n\n`
                        )
                    );
                }
                sample.generate('mappings.jsx', mappings.actual);
            }
        });
    }
});
