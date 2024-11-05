import fs from 'fs';
import assert, { AssertionError } from 'assert';
import { TestFunction } from 'mocha';
import { htmlx2jsx, svelte2tsx } from './build';
import path from 'path';
import { VERSION } from 'svelte/compiler';

let update_count = 0;
let all_tests_skipped = false;

function can_auto_update() {
    if (!process.argv.includes('--auto') && !all_tests_skipped) {
        if (update_count++ === 0) {
            process.on('exit', () => {
                const command = color.yellow('pnpm run test -- --auto');
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

    constructor(
        dir: string,
        readonly name: string
    ) {
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

        const sample = this;

        it.only(`${this.name} dependencies`, function () {
            try {
                fn(sample.generate.bind(sample));
            } catch (err) {
                this.test.title = sample.cmd('');
                throw err;
            }
        });
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

const isSvelte5Plus = Number(VERSION[0]) >= 5;

export function test_samples(dir: string, transform: TransformSampleFn, js: 'js' | 'ts') {
    for (const sample of each_sample(dir)) {
        if (sample.name.endsWith('.v5') && !isSvelte5Plus) continue;

        const svelteFile = sample.find_file('*.svelte');
        const expectedFile =
            isSvelte5Plus && !sample.name.endsWith('.v5')
                ? `expected-svelte5.${js}`
                : `expectedv2.${js}`;
        const config = {
            filename: svelteFile,
            sampleName: sample.name,
            emitOnTemplateError: false,
            preserveAttributeCase: sample.name.endsWith('-foreign-ns')
        };

        if (process.env.CI) {
            sample.checkDirectory({
                required: ['*.svelte', `expectedv2.${js}`],
                allowed: ['expected.js', `expected-svelte5.${js}`, 'expected.error.json']
            });
        } else {
            sample.checkDirectory({
                required: ['*.svelte'],
                allowed: [
                    'expected.js',
                    `expectedv2.${js}`,
                    `expected-svelte5.${js}`,
                    'expected.error.json'
                ]
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
                    generate(expectedFile, transform(input, config).code);
                });
            }

            sample.onError(function (generate, err: AssertionError) {
                if (!err || err.code !== 'ERR_ASSERTION') return;
                const { message, actual } = err;
                switch (message) {
                    case TestError.WrongExpected: {
                        generate(expectedFile, actual);
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
                    let actual = JSON.parse(JSON.stringify(error));
                    let expected = JSON.parse(sample.get('expected.error.json'));
                    if (isSvelte5Plus && actual && expected) {
                        // Error output looks a bit different but we only care about the start and end really
                        actual = { start: actual.start, end: actual.end };
                        expected = { start: expected.start, end: expected.end };
                    }
                    assert.deepEqual(actual, expected, TestError.WrongError);
                    config.emitOnTemplateError = true;
                }
                assert(hadError, TestError.MissingError);
            }

            const output = transform(input, config);

            if (sample.has('expected.js')) {
                sample.eval('expected.js', output);
            }

            if (isSvelte5Plus) {
                const actual = normalize(transform(input, config).code);
                if (sample.has(expectedFile)) {
                    assert.strictEqual(actual, sample.get(expectedFile), TestError.WrongExpected);
                } else {
                    const expected = sample.get(`expectedv2.${js}`);
                    try {
                        assert.strictEqual(actual, expected, TestError.WrongExpected);
                    } catch (e) {
                        // html2jsx tests don't have the default export
                        const expectDefaultExportPosition = expected.lastIndexOf(
                            '\n\nexport default class'
                        );
                        if (expectDefaultExportPosition === -1) {
                            throw e;
                        }
                        // retry with the last part (the returned default export) stripped because it's always differing between old and new,
                        // and if that fails then we're going to rethrow the original error
                        const expectedModified = expected.substring(0, expectDefaultExportPosition);
                        const actualModified = actual
                            .substring(0, actual.lastIndexOf('\nconst '))
                            // not added in Svelte 4
                            .replace(', exports: {}', '')
                            .replace(', bindings: ""', '');
                        try {
                            assert.strictEqual(
                                actualModified,
                                expectedModified,
                                TestError.WrongExpected
                            );
                        } catch (_) {
                            throw e;
                        }
                    }
                }
            } else {
                assert.strictEqual(
                    normalize(transform(input, config).code),
                    sample.get(expectedFile),
                    TestError.WrongExpected
                );
            }
        });
    }
}

type BaseConfig = {
    emitOnTemplateError?: boolean;
    filename?: string;
};
type Svelte2TsxConfig = Required<Parameters<typeof svelte2tsx>[1]>;

export function get_svelte2tsx_config(base: BaseConfig, sampleName: string): Svelte2TsxConfig {
    return {
        filename: base.filename,
        emitOnTemplateError: base.emitOnTemplateError,
        isTsFile: sampleName.startsWith('ts-'),
        namespace: sampleName.endsWith('-foreign-ns') ? 'foreign' : null,
        typingsNamespace: 'svelteHTML',
        mode: sampleName.endsWith('-dts') ? 'dts' : 'ts',
        accessors: sampleName.startsWith('accessors-config'),
        version: VERSION
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
    return obj as { [K in (typeof colors)[any] | keyof typeof mods]: (str: string) => string };
})(
    ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const,
    { grey: [90, 39], bold: [1, 22], italic: [3, 23], underline: [4, 24], hidden: [8, 28] } as const
);
