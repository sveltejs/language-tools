import svelte2tsx from '../build/index';
import { test_samples } from '../helpers';

describe('svelte2tsx', () => {
    test_samples(
        __dirname,
        (input, testName, filename) => {
            return svelte2tsx(input, {
                strictMode: testName.includes('strictMode'),
                isTsFile: testName.startsWith('ts-'),
                filename
            });
        },
        'tsx'
    );
});
