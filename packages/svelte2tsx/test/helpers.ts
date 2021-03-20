import fs from 'fs';
import assert, { AssertionError } from 'assert';
import { TestFunction } from 'mocha';
import svelte2tsx from './build/index';
import { htmlx2jsx } from './build/htmlxtojsx';

export function benchmark(fn: () => void) {
    return -Date.now() + (fn(), Date.now());
}

function normalize(content: string) {
    return content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function readFileSync(path: string) {
    return fs.existsSync(path) ? normalize(fs.readFileSync(path, 'utf-8')) : null;
}

function writeFileSync(path: string, content: string) {
    return fs.writeFileSync(path, normalize(content));
}

function existsSync(path: string) {
    return fs.existsSync(path);
}

function wildcard(str: string, target: string) {
    if (str[0] === '*') return target.endsWith(str.slice(1));
    return str === target;
}

export type GenerateFn = (file: string, content: string, skip?: boolean) => void;
type ErrorFn = (fn: GenerateFn, err: any) => void;

export class Sample {
    private readonly folder: string[];
    readonly directory: string;
    private skipped = false;
    private on_error?: ErrorFn;

    constructor(dir: string, readonly name: string) {
        this.directory = `${dir}/samples/${name}`;
        this.folder = fs.readdirSync(this.directory);
    }

    checkDirectory({ required = [], allowed = [] }: { allowed?: string[]; required?: string[] }) {
        const unchecked = new Set(required);
        const unknown = [];

        loop: for (const fileName of this.folder) {
            for (const name of unchecked) {
                if (wildcard(name, fileName)) {
                    unchecked.delete(name);
                    continue loop;
                }
            }
            for (const name of allowed) {
                if (wildcard(name, fileName)) {
                    continue loop;
                }
            }
            unknown.push(fileName);
        }

        if (unknown.length) {
            const errors = unknown
                .map((name) => `[Unexpected file] ${this.directory}/${name}`)
                .join('\n');
            if (process.env.CI) {
                throw new Error('\n' + errors);
            } else {
                this.log(color.yellow(errors));
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
                if (sample.on_error) sample.on_error?.(sample.generate.bind(sample), err);
                if (sample.skipped) this.skip();
                throw err;
            }
        });
    }

    log(...arr: string[]) {
        after(function () {
            after(function () {
                console.log(...arr);
            });
        });
    }

    generateDeps(fn: (generate: GenerateFn) => void) {
        if (process.env.CI) throw new Error(`Forgot to generate ${this.name} dependencies`);
        it.only(`${this.name} dependencies`, () => fn(this.generate.bind(this)));
    }

    onError(fn: ErrorFn) {
        this.on_error = fn;
    }

    has(target_file: string) {
        return this.folder.includes(target_file);
    }

    hasOnly(...files: string[]) {
        return this.folder.length === files.length && files.every((f) => this.has(f));
    }

    wildcard(file: string) {
        return this.folder.find((f) => wildcard(file, f));
    }

    get(file: string) {
        return readFileSync(`${this.directory}/${file}`);
    }

    private generate(fileName: string, content: string, skip = true) {
        const path = `${this.directory}/${fileName}`;
        if (process.env.CI) {
            throw new Error(`Forgot to generate sample file "${fileName}" at "${path}"`);
        }
        if (readFileSync(path) !== normalize(content)) {
            after(() => {
                const action = existsSync(path) ? 'updated' : 'generated';
                console.info(`\t[${action}] ${color.cyan(fileName)} (${color.underscore(path)}) `);
                writeFileSync(path, content);
            });
            if (skip) this.skipped = true;
        }
    }

    eval(fileName: string, ...args: any[]) {
        const fn = require(`${this.directory}/${fileName}`);
        fn(...args);
    }
}

type TransformSampleFn = (
    input: string,
    config: {
        filename: string;
        sampleName: string;
        emitOnTemplateError: boolean;
    }
) => ReturnType<typeof htmlx2jsx | typeof svelte2tsx>;

const enum TestError {
    WrongError = 'Expected an Error but not this one',
    MissingError = 'Expected an Error but got none',
    WrongExpected = 'Expected a different output'
}

export function test_samples(dir: string, transform: TransformSampleFn, jsx: 'jsx' | 'tsx') {
    for (const sample of each_sample(dir)) {
        const svelteFile = sample.wildcard('*.svelte');
        const config = {
            filename: svelteFile,
            sampleName: sample.name,
            emitOnTemplateError: false
        };

        if (process.env.CI) {
            sample.checkDirectory({
                required: ['*.svelte', `expected.${jsx}`],
                allowed: ['expected.js', 'expected.error.json']
            });
        } else {
            sample.checkDirectory({
                required: ['*.svelte'],
                allowed: ['expected.js', `expected.${jsx}`, 'expected.error.json']
            });

            if (sample.hasOnly(svelteFile)) {
                sample.generateDeps((generate) => {
                    const input = sample.get(svelteFile);
                    try {
                        transform(input, config);
                    } catch (error) {
                        generate('expected.error.json', JSON.stringify(error, null, 4) + '\n');
                        config.emitOnTemplateError = true;
                    }
                    generate(`expected.${jsx}`, transform(input, config).code);
                });
            }

            sample.onError(function (generate, err: AssertionError) {
                switch (err.message) {
                    case TestError.WrongExpected: {
                        generate(`expected.${jsx}`, err.actual, true);
                        break;
                    }
                    case TestError.WrongError: {
                        generate('expected.error.json', JSON.stringify(err.actual, null, 4) + '\n');
                        break;
                    }
                }
            });
        }

        sample.it(function () {
            const input = sample.get(svelteFile);

            if (sample.has('expected.error.json')) {
                let hadError = false;
                try {
                    transform(input, config);
                } catch (error) {
                    hadError = true;
                    assert.deepEqual(
                        JSON.parse(sample.get('expected.error.json')),
                        JSON.parse(JSON.stringify(error)),
                        TestError.WrongError
                    );
                }
                config.emitOnTemplateError = true;
                assert(hadError, TestError.MissingError);
            }

            const output = transform(input, config);

            assert.strictEqual(output.code, sample.get(`expected.${jsx}`), TestError.WrongExpected);

            if (sample.has('expected.js')) {
                sample.eval('expected.js', output);
            }
        });
    }
}
type BaseConfig = { emitOnTemplateError?: boolean; filename?: string };
type Svelte2TsxConfig = Required<Parameters<typeof svelte2tsx>[1]>;
export function get_svelte2tsx_config(base: BaseConfig, sampleName: string): Svelte2TsxConfig {
    return {
        filename: base.filename,
        emitOnTemplateError: base.emitOnTemplateError,
        strictMode: sampleName.includes('strictMode'),
        isTsFile: sampleName.startsWith('ts-')
    };
}

export function* each_sample(dir: string) {
    for (const name of fs.readdirSync(`${dir}/samples`)) {
        yield new Sample(dir, name);
    }
}
export const color = (function (colors, special) {
    const obj = {};
    const fn = (code: number, str: string) => `\x1b[${code}m${str}\x1b[0m`;
    for (let i = 0; i < colors.length; i++) obj[colors[i]] = fn.bind(null, 31 + i);
    for (let i = 0; i < special.length; i++) obj[special[i]] = fn.bind(null, 2 * (1 + i));
    return obj as { [K in (typeof special | typeof colors)[any]]: (str: string) => string };
})(
    ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const,
    ['dim', 'underscore'] as const
);
