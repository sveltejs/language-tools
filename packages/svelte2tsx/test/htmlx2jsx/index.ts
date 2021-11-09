import { htmlx2jsx, htmlx2jsx_v2 } from '../build';
import { test_samples } from '../helpers';

describe('htmlx2jsx', () => {
    test_samples(
        __dirname,
        (input, { emitOnTemplateError, preserveAttributeCase, useNewTransformation }) => {
            return useNewTransformation
                ? htmlx2jsx_v2(input, { emitOnTemplateError, preserveAttributeCase })
                : htmlx2jsx(input, { emitOnTemplateError, preserveAttributeCase });
        },
        'jsx'
    );
});
