const fs = require('fs');
const assert = require('assert');

function benchmark(fn) {
    return -Date.now() + (fn(), Date.now());
}

function readFileSync(path) {
    return fs.existsSync(path)
        ? fs.readFileSync(path, 'utf-8').replace(/\r\n/g, '\n').replace(/\s+$/, '')
        : null;
}

function check_dir(path, { allowed = [], required = allowed }) {
    const unchecked = new Set(required);
    const unknown = [];
    loop: for (const fileName of fs.readdirSync(path)) {
        for (const name of unchecked) {
            if ('*' === name[0] ? fileName.endsWith(name.slice(1)) : name === fileName) {
                unchecked.delete(name);
                continue loop;
            }
        }
        for (const name of allowed) {
            if ('*' === name[0] ? fileName.endsWith(name.slice(1)) : name === fileName) {
                continue loop;
            }
        }
        unknown.push(fileName);
    }
    if (unknown.length !== 0) {
        after(() => {
            for (const name of unknown) {
                const msg = `Unexpected file ${path.split('/').slice(-1)}/${name}`;
                if (process.env.CI) {
                    throw new Error(msg);
                } else {
                    console.info(msg);
                }
            }
        });
    }
    if (unchecked.size !== 0) {
        throw new Error(
            `Expected file(s) ${[...unchecked].map((str) => `"${str}"`).join(', ')} in ${path}`
        );
    }
}

function test_samples(dir, transform, tsx) {
    for (const testName of fs.readdirSync(`${dir}/samples`)) {
        const path = `${dir}/samples/${testName}`;
        const expected_path = `${path}/expected.${tsx}`;
        const has_expected = fs.existsSync(expected_path);
        const solo = testName.endsWith('.solo');
        const skip = testName.startsWith('.');
        check_dir(path, {
            required: ['*.svelte'],
            allowed: ['expected.js', `expected.${tsx}`, 'test.js']
        });
        (skip ? it.skip : solo ? it.only : it)(testName, function () {
            const testJsPath = `${path}/test.js`;
            if (fs.existsSync(testJsPath)) {
                const test = require(testJsPath);
                test();
                return;
            }

            const { filename, content } = get_input_content(path);
            const output = transform(content, testName, filename);
            if (!has_expected) {
                after(() => {
                    fs.writeFileSync(expected_path, output.code);
                    console.info(`Generated ${testName}/expected.${tsx}`);
                });
                this.skip();
            } else {
                assert.strictEqual(output.code, readFileSync(expected_path));
            }
            if (fs.existsSync(`${path}/expected.js`)) {
                const run = require(`${path}/expected.js`);
                run(output);
            }
        });
    }
}

/**
 *
 * @param {string} dirPath
 */
function get_input_content(dirPath) {
    const filename = fs.readdirSync(dirPath).find((f) => f.endsWith('.svelte'));
    const content = readFileSync(`${dirPath}/${filename}`);
    return { filename, content };
}

module.exports = { benchmark, test_samples, get_input_content, readFileSync };
