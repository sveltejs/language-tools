import assert from 'assert';
import fs from 'fs';
import type { htmlx2jsx as htmlx2jsxFn } from '../src/htmlxtojsx/index';
import type { svelte2tsx as svelte2tsxFn } from '../src/svelte2tsx/index';
export function benchmark(fn: () => void) {
    return -Date.now() + (fn(), Date.now());
}

function readFileSync(path: string) {
    if (!fs.existsSync(path)) return undefined;
    return fs.readFileSync(path, 'utf-8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function check_dir(
    dirPath: string,
    fileNames: string[],
    dir_config: { allowed: string[]; required?: string[] }
) {
    const unchecked = new Set(dir_config.required ?? dir_config.allowed);
    const unknown = [];
    loop: for (const fileName of fileNames) {
        for (const name of unchecked) {
            if ('*' === name[0] ? fileName.endsWith(name.slice(1)) : name === fileName) {
                unchecked.delete(name);
                continue loop;
            }
        }
        for (const name of dir_config.allowed) {
            if ('*' === name[0] ? fileName.endsWith(name.slice(1)) : name === fileName) {
                continue loop;
            }
        }
        unknown.push(fileName);
    }
    if (unknown.length !== 0) {
        after(function () {
            for (const name of unknown) {
                const msg = `Unexpected file ${dirPath.split('/').slice(-1)}/${name}`;
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
            `Expected file(s) ${[...unchecked].map((str) => `"${str}"`).join(', ')} in ${dirPath}`
        );
    }
}
type TransformFn = typeof htmlx2jsxFn | typeof svelte2tsxFn;
type TransformedFile = ReturnType<TransformFn>;
type TransformSampleFn = (config: {
    sampleName: string;
    fileName: string;
    input: string;
    emitOnTemplateError: boolean;
}) => TransformedFile;

function generateExpected(context: Mocha.Context, path: string, code: string) {
    if (process.env.CI) {
        throw new Error(`Forgot to generate expected output at "${path}"`);
    }
    after(() => {
        fs.writeFileSync(path, code);
        const name = path.slice(path.lastIndexOf('/', path.lastIndexOf('/')) + 1);
        console.info(`Generated ${name}`);
    });
    context.skip();
}

export function test_samples(dir: string, transform: TransformSampleFn, jsx: 'jsx' | 'tsx') {
    for (const sampleName of fs.readdirSync(`${dir}/samples`)) {
        const sampleDirectory = `${dir}/samples/${sampleName}`;
        const folder = fs.readdirSync(sampleDirectory);
        const fileName = folder.find((f) => f.endsWith('.svelte'));

        check_dir(sampleDirectory, folder, {
            required: ['*.svelte'],
            allowed: ['expected.js', `expected.${jsx}`, 'expected.error.json']
        });

        const sveltePath = `${sampleDirectory}/${fileName}`;
        const expectedPath = `${sampleDirectory}/expected.${jsx}`;
        const errorPath = `${sampleDirectory}/expected.error.json`;

        const hasCustomTest = folder.includes('expected.js');
        const expectsError = folder.includes('expected.error.json');
        const shouldGenerateExpected = !folder.includes(`expected.${jsx}`);
        const shouldGenerateError = expectsError && !readFileSync(errorPath);

        // generates "expected.tsx" when it's missing
        // generates "expected.error.json" content if file exists but is empty

        const solo = sampleName.endsWith('.solo');
        const skip = sampleName.startsWith('.');
        (skip ? it.skip : solo ? it.only : it)(sampleName, function () {
            const config = {
                sampleName,
                fileName,
                input: readFileSync(sveltePath),
                emitOnTemplateError: false
            };

            if (expectsError) {
                let hadError = false;
                try {
                    transform(config);
                } catch (error) {
                    hadError = true;
                    if (shouldGenerateError) {
                        generateExpected(this, errorPath, JSON.stringify(error, void 0, '\t'));
                    } else if (expectsError) {
                        assert.deepEqual(
                            JSON.parse(readFileSync(errorPath)),
                            JSON.parse(JSON.stringify(error))
                        );
                    } else {
                        throw error;
                    }
                    config.emitOnTemplateError = true;
                }
                if (!hadError) {
                    throw new Error(
                        `Sample "${sampleName}" expected an error but got none.\n\n\tcmd click: ${errorPath}`
                    );
                }
            }

            const output = transform(config);

            if (shouldGenerateExpected) {
                generateExpected(this, expectedPath, output.code);
            } else {
                assert.strictEqual(output.code, readFileSync(expectedPath));
            }

            if (hasCustomTest) {
                // see example at "svelte2tsx\samples\component-events-interface\expected.js"
                const fn = require(`${sampleDirectory}/expected.js`);
                fn(output);
            }
        });
    }
}
