import { htmlx2jsx } from '../build';
import { test_samples } from '../helpers';

describe('htmlx2jsx', () => {
    test_samples(
        __dirname,
        (input, { emitOnTemplateError, preserveAttributeCase, hasEventDefinitions }) => {
            return htmlx2jsx(input, {
                emitOnTemplateError,
                preserveAttributeCase,
                hasEventDefinitions
            });
        },
        'jsx'
    );
});
