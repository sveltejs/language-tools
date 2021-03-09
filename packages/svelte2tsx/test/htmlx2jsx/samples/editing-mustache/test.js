const assert = require('assert');
const { htmlx2jsx } = require('../../../build/htmlxtojsx');
const { get_input_content, readFileSync } = require('../../../helpers');

module.exports = function () {
    const input = get_input_content(__dirname);

    assert.throws(
        () => {
            htmlx2jsx(input.content);
        },
        {
            name: 'ParseError',
            code: 'parse-error',
            start: { line: 1, column: 8, character: 8 },
            end: { line: 1, column: 8, character: 8 },
            frame: '1: {abc.   }\n           ^\n2: {abc?. }\n3: {abc ?}'
        }
    );

    const expected_path = `${__dirname}/expected.jsx`;
    assert.strictEqual(
        htmlx2jsx(input.content, { emitOnTemplateError: true }).code,
        readFileSync(expected_path).toString()
    );
};