import { VERSION, parse } from 'svelte/compiler';
import { htmlx2jsx } from '../build';
import { test_samples } from '../helpers';
import ts from 'typescript';

describe('htmlx2jsx', () => {
    test_samples(
        __dirname,
        (input, { emitOnTemplateError, preserveAttributeCase }) => {
            return htmlx2jsx(ts, input, parse, {
                emitOnTemplateError,
                preserveAttributeCase,
                typingsNamespace: 'svelteHTML',
                svelte5Plus: Number(VERSION[0]) >= 5
            });
        },
        'js'
    );
});
