import svelte2tsx from '../build/index';
import { test_samples } from '../helpers';

describe('svelte2tsx', () => {
    test_samples(
        __dirname,
        (input, { sampleName, fileName, emitOnTemplateError }) => {
            return svelte2tsx(input, {
                strictMode: sampleName.includes('strictMode'),
                isTsFile: sampleName.startsWith('ts-'),
                filename: fileName,
                emitOnTemplateError
            });
        },
        'tsx'
    );
});
