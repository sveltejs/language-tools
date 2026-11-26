import assert from 'assert';
import { svelte2tsx } from '../build';
import { get_svelte2tsx_config, test_samples } from '../helpers';

describe('svelte2tsx', () => {
    test_samples(
        __dirname,
        (input, config) => {
            return svelte2tsx(input, get_svelte2tsx_config(config, config.sampleName));
        },
        'ts'
    );

    it('keeps the order of shimPaths and leaves the array as it is', () => {
        const shimPaths = ['/shims/a.d.ts', '/shims/b.d.ts', '/shims/c.d.ts'];
        const references = () =>
            svelte2tsx('<script lang="ts">let a = 1;</script>', { shimPaths })
                .code.split('\n')
                .filter((line) => line.startsWith('///<reference path='));
        const expected = shimPaths.map((shimPath) => `///<reference path="${shimPath}" />`);

        assert.deepStrictEqual(references(), expected);
        // the same array again (the content mapper passes its cached array to every transform)
        assert.deepStrictEqual(references(), expected);
        assert.deepStrictEqual(shimPaths, ['/shims/a.d.ts', '/shims/b.d.ts', '/shims/c.d.ts']);
    });
});
