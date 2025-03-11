import { svelte2tsx } from '../build';
import { get_svelte2tsx_config, test_samples } from '../helpers';

// done in vitest now
describe.skip('svelte2tsx', () => {
    test_samples(
        __dirname,
        (input, config) => {
            return svelte2tsx(input, get_svelte2tsx_config(config, config.sampleName));
        },
        'ts'
    );
});
