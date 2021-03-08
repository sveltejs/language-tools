import assert from 'assert';
import fs from 'fs';
import { TestFunction } from 'mocha';
import svelte2tsx from './build';
import { htmlx2jsx } from './build/htmlxtojsx';
export function benchmark(fn: () => void) {
    return -Date.now() + (fn(), Date.now());
}
export function readFileSync(path: string) {
    if (!fs.existsSync(path)) return undefined;
    return fs.readFileSync(path, 'utf-8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

type TransformedFile = ReturnType<typeof htmlx2jsx | typeof svelte2tsx>;
export type FileSampleConfig = {
    sampleName: string;
    fileName: string;
    input: string;
    emitOnTemplateError: boolean;
};
type TransformSampleFn = (config: FileSampleConfig) => TransformedFile;

export function test_samples(dir: string, transform: TransformSampleFn, jsx: 'jsx' | 'tsx') {
    for (const sample of each_sample(dir)) {
        const svelteFile = sample.folder.find((f) => f.endsWith('.svelte'));

        sample.check({
            required: ['*.svelte'],
            allowed: ['expected.js', `expected.${jsx}`, 'expected.error.json']
        });

        const hasCustomTest = sample.has('expected.js');
        const expectsError = sample.has('expected.error.json');
        const shouldGenerateExpected = !sample.has(`expected.${jsx}`);
        const shouldGenerateError = expectsError && sample.get('expected.error.json') === '';

        // generates "expected.tsx" when it's missing
        // generates "expected.error.json" content if file exists but is empty

        sample.it(function () {
            const config = {
                sampleName: sample.name,
                fileName: svelteFile,
                input: sample.get(svelteFile),
                emitOnTemplateError: false
            };

            if (expectsError) {
                let hadError = false;
                try {
                    transform(config);
                } catch (error) {
                    hadError = true;
                    if (shouldGenerateError) {
                        sample.generate(
                            'expected.error.json',
                            JSON.stringify(error, void 0, '    ') + '\n'
                        );
                    } else if (expectsError) {
                        assert.deepEqual(
                            JSON.parse(sample.get('expected.error.json')),
                            JSON.parse(JSON.stringify(error))
                        );
                    } else {
                        throw error;
                    }
                    config.emitOnTemplateError = true;
                }
                if (!hadError) {
                    throw new Error(
                        `Sample "${sample.name}" expected a template error but got none.`
                    );
                }
            }

            const output = transform(config);

            if (shouldGenerateExpected) {
                sample.generate(`expected.${jsx}`, output.code);
            } else {
                assert.strictEqual(output.code, sample.get(`expected.${jsx}`));
            }

            if (hasCustomTest) {
                // see example at "svelte2tsx\samples\component-events-interface\expected.js"
                sample.run('expected.js', output);
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
            sample.context = this;
            fn();
        });
    }
    has(file: string) {
        return this.folder.includes(file);
    }
    get(file: string) {
        const content = readFileSync(`${this.directory}/${file}`);
        if (!content) return content;
        if (this.name.includes('windows')) return content.replace(/\n/g, '\r\n');
        return content;
    }
    private context: Mocha.Context;
    generate(fileName: string, content: string, skip = true) {
        const path = `${this.directory}/${fileName}`;
        if (process.env.CI) {
            throw new Error(`Forgot to generate expected sample result at "${path}"`);
        }
        after(() => {
            fs.writeFileSync(path, content);
        });
        if (skip) this.context.skip();
    }

    run(fileName: string, ...args: any[]) {
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
        if (unknown.length !== 0) {
            after(() => {
                for (const name of unknown) {
                    const msg = `Unexpected file at "${this.directory}/${name}"`;
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
                `Expected file(s) ${[...unchecked].map((str) => `"${str}"`).join(', ')} in "${
                    this.directory
                }"`
            );
        }
    }
}
export function* each_sample(dir: string) {
    for (const name of fs.readdirSync(`${dir}/samples`)) {
        yield new Sample(dir, name);
    }
}
export function binarySearch<T extends object | number>(
    array: T[],
    target: number,
    key?: keyof (T & object)
) {
    if (!array || 0 === array?.length) return -1;
    let low = 0;
    let high = array.length - 1;
    while (low <= high) {
        const index = low + ((high - low) >> 1);
        const item = undefined === key ? array[index] : array[index][key];
        if (item === target) return index;
        if (item < target) low = index + 1;
        else high = index - 1;
    }
    if ((low = ~low) < 0) low = ~low - 1;
    return low;
}
