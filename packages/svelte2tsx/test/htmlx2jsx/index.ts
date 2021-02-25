import { htmlx2jsx } from '../build/htmlxtojsx';
import { test_samples } from '../helpers';

describe('htmlx2jsx', function () {
    test_samples(
        __dirname,
        function ({ input, emitOnTemplateError }) {
            return htmlx2jsx(input, { emitOnTemplateError });
        },
        'jsx'
    );
});
