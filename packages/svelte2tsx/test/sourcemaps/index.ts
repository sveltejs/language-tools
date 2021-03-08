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
            if (!process.env.CI) {
                sample.generate(
                    'output.tsx',
                    `${generated.code}\n//# sourceMappingURL=${generated.map.toUrl()}`,
                    false
                );
            }
            const debug = process.env.CI
                ? ''
                : `To visualize the output in detail:\n\n` +
                  `1) Go to https://evanw.github.io/source-map-visualization/\n` +
                  `2) Upload "generated.tsx" from ${sample.directory}\n`;

            if (sample.has('test.html')) {
                test_sample_result(
                    original.code,
                    generated.code,
                    sample.get('test.html'),
                    decoded,
                    `SourceMapping test failed\n\n` + debug
                );
            }

            if (mappings.expected === mappings.actual && !shouldGenerate) return;

            if (process.env.CI) {
                assert(sample.has('mappings.jsx'), `Forgot to generate expected sample results`);
                assert.fail(`Source Mappings changed, run tests locally to re-generate results.`);
            } else {
                after(() => console.log(`SourceMapping Changed (${sample.name})\n\n` + debug));
                sample.generate('mappings.jsx', mappings.actual);
            }
        });
    }
});
