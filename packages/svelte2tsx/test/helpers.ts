import fs from 'fs';
import assert, { AssertionError } from 'assert';
import { TestFunction } from 'mocha';
import { htmlx2jsx, svelte2tsx } from './build';
import path from 'path';

let update_count = 0;
let all_tests_skipped = false;

function can_auto_update() {
    if (!process.argv.includes('--auto') && !all_tests_skipped) {
        if (update_count++ === 0) {
            process.on('exit', () => {
                const command = color.yellow('yarn run test --auto');
                console.log(`  Run ${command} to update ${update_count} files\n`);
            });
        }
        return false;
    }
    return true;
}
export function benchmark(fn: () => void) {
    return -Date.now() + (fn(), Date.now());
}

function normalize(content: string) {
    return content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function print_error(err: Error) {
    return JSON.stringify(err, null, 4) + '\n';
}

function readFileSync(path: string) {
    return fs.existsSync(path) ? normalize(fs.readFileSync(path, 'utf-8')) : null;
}

function writeFileSync(path: string, content: string) {
    return fs.writeFileSync(path, normalize(content));
}

function is_same_file(str: string, target: string) {
    if (str[0] === '*') return target.endsWith(str.slice(1));
    return str === target;
}

export type GenerateFn = (file: string, content: string, skip?: boolean) => void;
type ErrorFn = (fn: GenerateFn, err: any) => void;

export class Sample {
    private readonly folder: string[];
    private readonly directory: string;
    private skipped = false;
    private on_error?: ErrorFn;

    constructor(dir: string, readonly name: string) {
        this.directory = path.resolve(dir, 'samples', name);
        this.folder = fs.readdirSync(this.directory);
    }

    checkDirectory({ required = [], allowed = [] }: { allowed?: string[]; required?: string[] }) {
        const unchecked = new Set(required);
        const unknown = [];

        loop: for (const fileName of this.folder) {
            for (const name of unchecked) {
                if (is_same_file(name, fileName)) {
                    unchecked.delete(name);
                    continue loop;
                }
            }
            for (const name of allowed) {
                if (is_same_file(name, fileName)) {
                    continue loop;
                }
            }
            unknown.push(fileName);
        }

        if (unknown.length) {
            const errors = unknown.map((name) => `[Unexpected file] ${this.cmd(name)}`).join('\n');
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
                if (sample.on_error) sample.on_error(sample.generate.bind(sample), err);
                if (sample.skipped) this.skip();
                this.test.title = sample.cmd('');
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

    onError(fn: ErrorFn) {
        assert(!this.on_error);
        this.on_error = fn;
    }

    has(target_file: string) {
        return this.folder.includes(target_file);
    }

    hasOnly(...fileNames: string[]) {
        return this.folder.length === fileNames.length && fileNames.every((f) => this.has(f));
    }

    /**
     * Returns first found file that matches the fileName,
     * or ends with it in case of a wildcard search.
     */
    find_file(fileName: string) {
        return this.folder.find((f) => is_same_file(fileName, f));
    }

    at(file: string) {
        return path.resolve(this.directory, file);
    }

    cmd(file: string) {
        return this.at(file).replace(process.cwd(), '').slice(1).replace(/\\/g, '/');
    }

    get(fileName: string) {
        return readFileSync(this.at(fileName));
    }

    generateDeps(fn: (generate: GenerateFn) => void) {
        if (process.env.CI) {
            throw new Error(`Tried to generate ${this.name} dependencies`);
        }
        all_tests_skipped = true;
        it.only(`${this.name} dependencies`, () => fn(this.generate.bind(this)));
    }

    private generate(file: string, content: string, skip = true) {
        if (process.env.CI) {
            throw new Error(
                `Tried to generate file at ${this.cmd(file)}\nRun tests locally to fix`
            );
        }
        if (this.get(file) !== normalize(content)) {
            const action = this.has(file) ? 'updated' : 'generated';
            if (skip) {
                if (action === 'updated' && !can_auto_update()) return;
                this.skipped = true;
            }
            after(() => {
                console.log(`\t[${action}] ${color.cyan(file)} ${color.grey(this.cmd(file))}`);
                writeFileSync(this.at(file), content);
            });
        }
    }

    eval(fileName: string, ...args: any[]) {
        const fn = require(this.at(fileName));
        fn(...args);
    }
}

type TransformSampleFn = (
    input: string,
    config: {
        filename: string;
        sampleName: string;
        emitOnTemplateError: boolean;
        preserveAttributeCase: boolean;
    }
) => ReturnType<typeof htmlx2jsx | typeof svelte2tsx>;

const enum TestError {
    WrongError = 'Expected an Error but not this one',
    MissingError = 'Expected an Error but got none',
    WrongExpected = 'Expected a different output'
}

export function test_samples(dir: string, transform: TransformSampleFn, jsx: 'jsx' | 'tsx') {
    for (const sample of each_sample(dir)) {
        const svelteFile = sample.find_file('*.svelte');
        const config = {
            filename: svelteFile,
            sampleName: sample.name,
            emitOnTemplateError: false,
            preserveAttributeCase: sample.name.endsWith('-foreign-ns')
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

            if (sample.hasOnly(svelteFile) || sample.hasOnly(svelteFile, 'expected.js')) {
                sample.generateDeps((generate) => {
                    const input = sample.get(svelteFile);
                    try {
                        transform(input, config);
                    } catch (error) {
                        generate('expected.error.json', print_error(error));
                        config.emitOnTemplateError = true;
                    }
                    generate(`expected.${jsx}`, transform(input, config).code);
                });
            }

            sample.onError(function (generate, err: AssertionError) {
                if (!err || err.code !== 'ERR_ASSERTION') return;
                const { message, actual } = err;
                switch (message) {
                    case TestError.WrongExpected: {
                        generate(`expected.${jsx}`, actual);
                        break;
                    }
                    case TestError.WrongError: {
                        generate('expected.error.json', print_error(actual));
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
                        JSON.parse(JSON.stringify(error)),
                        JSON.parse(sample.get('expected.error.json')),
                        TestError.WrongError
                    );
                    config.emitOnTemplateError = true;
                }
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
        isTsFile: sampleName.startsWith('ts-'),
        namespace: sampleName.endsWith('-foreign-ns') ? 'foreign' : null
    };
}

export function* each_sample(dir: string) {
    for (const name of fs.readdirSync(`${dir}/samples`)) {
        yield new Sample(dir, name);
    }
}

export const color = (function (colors, mods) {
    const obj = {};
    const fn = (c1: number, c2: number, str: string) => `\x1b[${c1}m${str}\x1b[${c2}m`;
    for (let i = 0; i < colors.length; i++) obj[colors[i]] = fn.bind(null, 30 + i, 39);
    for (const key in mods) obj[key] = fn.bind(null, mods[key][0], mods[key][1]);
    return obj as { [K in typeof colors[any] | keyof typeof mods]: (str: string) => string };
})(
    ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const,
    { grey: [90, 39], bold: [1, 22], italic: [3, 23], underline: [4, 24], hidden: [8, 28] } as const
);
