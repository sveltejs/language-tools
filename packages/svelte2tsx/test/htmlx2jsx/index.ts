import { VERSION, parse } from 'svelte/compiler';
import { htmlx2jsx } from '../build';
import { test_samples } from '../helpers';

describe('htmlx2jsx', () => {
    test_samples(
        __dirname,
        (input, { emitOnTemplateError, preserveAttributeCase }) => {
            return htmlx2jsx(input, parse, {
                emitOnTemplateError,
                preserveAttributeCase,
                typingsNamespace: 'svelteHTML',
                svelte5Plus: Number(VERSION[0]) >= 5
            });
        },
        'js'
    );
});
