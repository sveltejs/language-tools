import assert from 'assert';
import fs from 'fs';
import { TestFunction } from 'mocha';
import svelte2tsx from '../build/index';
import { htmlx2jsx } from '../build/htmlxtojsx';

export function benchmark(fn: () => void) {
    return -Date.now() + (fn(), Date.now());
}

function readFileSync(path: string) {
    return fs.existsSync(path)
        ? fs.readFileSync(path, 'utf-8').replace(/\r\n/g, '\n').replace(/\s+$/, '')
        : null;
}
type TransformFn = typeof htmlx2jsx | typeof svelte2tsx;
type TransformedFile = ReturnType<TransformFn>;
type TransformSampleFn = (
    input: string,
    config: {
        sampleName: string;
        fileName: string;
        emitOnTemplateError: boolean;
    }
) => TransformedFile;

export function test_samples(dir: string, transform: TransformSampleFn, jsx: 'jsx' | 'tsx') {
    for (const sample of each_sample(dir)) {
        const svelteFile = sample.folder.find((f) => f.endsWith('.svelte'));

        sample.check({
            required: ['*.svelte'],
            allowed: ['expected.js', `expected.${jsx}`, 'expected.error.json']
        });

        const shouldGenerateExpected = !sample.has(`expected.${jsx}`);
        const shouldGenerateError = sample.get('expected.error.json') === '';

        sample.it(function () {
            const input = sample.get(svelteFile);
            const config = {
                fileName: svelteFile,
                sampleName: sample.name,
                emitOnTemplateError: false
            };

            if (sample.has('expected.error.json')) {
                let hadError = false;
                try {
                    transform(input, config);
                } catch (error) {
                    hadError = true;
                    if (shouldGenerateError) {
                        sample.generate(
                            'expected.error.json',
                            JSON.stringify(error, void 0, '    ') + '\n'
                        );
                    } else {
                        assert.deepEqual(
                            JSON.parse(sample.get('expected.error.json')),
                            JSON.parse(JSON.stringify(error))
                        );
                    }
                }
                config.emitOnTemplateError = true;
                assert(hadError, `Expected a template error but got none`);
            }

            const output = transform(input, config);

            if (shouldGenerateExpected) {
                sample.generate(`expected.${jsx}`, output.code);
            } else {
                assert.strictEqual(output.code, sample.get(`expected.${jsx}`));
            }

            if (sample.has('expected.js')) {
                sample.eval('expected.js', output);
            }
        });
    }
}
class Sample {
    readonly folder: string[];
    readonly directory: string;
    constructor(dir: string, readonly name: string) {
        this.directory = `${dir}/samples/${name}`;
        this.folder = fs.readdirSync(this.directory);
    }
    it(fn: () => void) {
        let _it = it;
        if (this.name.startsWith('.')) {
            _it = it.skip as TestFunction;
        } else if (this.name.endsWith('.solo')) {
            _it = it.only as TestFunction;
        }
        const sample = this;
        _it(this.name, function () {
            try {
                fn();
                if (sample.skipped) this.skip();
            } catch (err) {
                if (sample.skipped) this.skip();
                throw err;
            }
        });
    }
    has(file: string) {
        return this.folder.includes(file);
    }
    get(file: string) {
        return readFileSync(`${this.directory}/${file}`);
    }
    private skipped = false;
    generate(fileName: string, content: string) {
        const path = `${this.directory}/${fileName}`;
        if (process.env.CI) {
            throw new Error(`Forgot to generate expected sample result at "${path}"`);
        }
        after(() => {
            fs.writeFileSync(path, content);
            console.info(`(generated) ${this.name}/${fileName}`);
        });
        this.skipped = true;
    }
    eval(fileName: string, ...args: any[]) {
        const fn = require(`${this.directory}/${fileName}`);
        fn(...args);
    }
    check({ required = [], allowed = required }: { allowed?: string[]; required?: string[] }) {
        const unchecked = new Set(required);
        const unknown = [];
        loop: for (const fileName of this.folder) {
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
        if (unknown.length) {
            const errors =
                unknown.map((name) => `Unexpected file "${name}"`).join('\n') +
                `\nat ${this.directory}`;
            if (process.env.CI) {
                throw new Error('\n' + errors);
            } else {
                after(() => {
                    console.log(errors);
                });
            }
        }
        if (unchecked.size) {
            throw new Error(
                `Expected file${unchecked.size === 1 ? '' : 's'} ${[...unchecked]
                    .map((str) => `"${str}"`)
                    .join(', ')} in "${this.directory}"`
            );
        }
    }
}
export function* each_sample(dir: string) {
    for (const name of fs.readdirSync(`${dir}/samples`)) {
        yield new Sample(dir, name);
    }
}
