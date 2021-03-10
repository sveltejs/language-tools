const assert = require('assert');
const svelte2tsx = require('../../../build/index');
const { get_input_content, readFileSync } = require('../../../helpers');

module.exports = function () {
    const input = get_input_content(__dirname);

    assert.throws(
        () => {
            svelte2tsx(input.content);
        },
        {
            name: 'ParseError',
            code: 'parse-error',
            start: { line: 1, column: 4, character: 4 },
            end: { line: 1, column: 4, character: 4 },
            frame: '1: {a?.}\n       ^'
        }
    );

    const expected_path = `${__dirname}/expected.tsx`;
    assert.strictEqual(
        svelte2tsx(input.content, {
            emitOnTemplateError: true,
            filename: input.filename
        }).code,
        readFileSync(expected_path).toString()
    );
};
