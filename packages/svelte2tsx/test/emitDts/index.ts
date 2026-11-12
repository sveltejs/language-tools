import * as assert from 'assert';
import * as fs from 'fs';
import { join, relative, sep } from 'path';
import { emitDts } from '../../src';
import { VERSION } from 'svelte/compiler';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

function rimraf(path: string) {
    ((fs as any).rmSync || fs.rmdirSync)(path, { recursive: true, force: true });
}

/**
 * Recursively find .d.ts and .d.ts.map files under `dir`, excluding
 * `declarationDir`, `expected`, and `node_modules` directories.
 */
function findDtsFiles(dir: string, declarationDir: string): string[] {
    const results: string[] = [];
    const skip = new Set(['expected', 'node_modules', declarationDir]);
    function walk(current: string) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!skip.has(entry.name)) walk(join(current, entry.name));
            } else if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
                results.push(join(current, entry.name));
            }
        }
    }
    walk(dir);
    return results;
}

const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

/** Samples with a `.v4` suffix only run against Svelte 4, all others only against Svelte 5+ */
function isSvelte4Sample(sample: string) {
    return /\.v4(\.solo)?$/.test(sample);
}

async function testEmitDts(sample: string) {
    const cwd = join(__dirname, 'samples', sample);

    const spuriousFiles: string[] = [];
    const config = fs.existsSync(join(cwd, 'config.json'))
        ? JSON.parse(fs.readFileSync(join(cwd, 'config.json'), 'utf-8'))
        : {};
    const declarationDir: string = config.declarationDir ?? 'package';
    const preExistingTopDirs = new Set(
        fs
            .readdirSync(cwd, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
    );

    try {
        const preExistingDts = new Set(findDtsFiles(cwd, declarationDir));

        await emitDts({
            declarationDir,
            svelteShimsPath: require.resolve(join(process.cwd(), 'svelte-shims-v4.d.ts')),
            ...config,
            libRoot: config.libRoot ? join(cwd, config.libRoot) : join(cwd, 'src')
        });

        // Assert no .d.ts files were written outside declarationDir
        const newDts = findDtsFiles(cwd, declarationDir).filter((f) => !preExistingDts.has(f));
        spuriousFiles.push(...newDts);
        assert.deepStrictEqual(
            newDts.map((f) => relative(cwd, f)),
            [],
            'emitDts wrote declaration files outside declarationDir'
        );

        const actual_files = fs.readdirSync(join(cwd, declarationDir));

        if (!fs.existsSync(join(cwd, 'expected'))) {
            fs.mkdirSync(join(cwd, 'expected'), { recursive: true });
            for (const file of actual_files) {
                fs.copyFileSync(join(cwd, declarationDir, file), join(cwd, 'expected', file));
            }
        } else {
            const expectedFiles = fs.readdirSync(join(cwd, 'expected'));
            assert.strictEqual(
                actual_files.length,
                expectedFiles.length,
                'Contains a different number of files. Expected ' +
                    expectedFiles.join(',') +
                    ' , got ' +
                    actual_files.join(',')
            );

            for (const file of actual_files) {
                assert.strictEqual(
                    expectedFiles.includes(file),
                    true,
                    `Did not expect file or folder ${file}`
                );
                const expectedContent = fs
                    .readFileSync(join(cwd, 'expected', file), 'utf-8')
                    .replace(/\r\n/g, '\n');
                const actualContent = fs
                    .readFileSync(join(cwd, declarationDir, file), 'utf-8')
                    .replace(/\r\n/g, '\n');
                assert.strictEqual(
                    actualContent,
                    expectedContent,
                    `Expected equal file contents for ${file}`
                );
            }
        }
    } finally {
        rimraf(join(cwd, declarationDir));
        for (const f of spuriousFiles) {
            const topLevel = relative(cwd, f).split(sep)[0];
            if (!preExistingTopDirs.has(topLevel)) {
                // Directory was created by emitDts — safe to remove the whole tree
                rimraf(join(cwd, topLevel));
            } else {
                // Pre-existing directory — only remove the specific files
                try {
                    fs.unlinkSync(f);
                } catch {
                    /* ignore */
                }
                try {
                    fs.unlinkSync(f + '.map');
                } catch {
                    /* ignore */
                }
            }
        }
    }
}

describe('emitDts', async () => {
    const samples = fs.readdirSync(join(__dirname, 'samples'));
    let samplesToTest = samples.filter((s) => s.endsWith('.solo'));
    samplesToTest = samplesToTest.length ? samplesToTest : samples;
    for (const sample of samplesToTest) {
        if (isSvelte4Sample(sample) === isSvelte5Plus) continue;
        it(sample, async () => await testEmitDts(sample)).timeout(10000);
    }

    it('maps component declarations back to the original .svelte source', async () => {
        const cwd = join(__dirname, 'mappings');
        const declarationDir = join(cwd, 'package');

        try {
            await emitDts({
                declarationDir,
                svelteShimsPath: require.resolve(join(process.cwd(), 'svelte-shims.d.ts')),
                libRoot: join(cwd, 'src')
            });

            const dts = fs.readFileSync(join(declarationDir, 'Test.svelte.d.ts'), 'utf-8');
            const map = new TraceMap(
                fs.readFileSync(join(declarationDir, 'Test.svelte.d.ts.map'), 'utf-8')
            );
            const source_lines = fs
                .readFileSync(join(cwd, 'src', 'Test.svelte'), 'utf-8')
                .split('\n');

            for (const [generated, expected_line] of [
                ['foo: string', '    export let foo: string;'],
                ['greet?: (greeting: string)', '    export function greet(greeting: string) {']
            ]) {
                const index = dts.indexOf(generated);
                assert.notStrictEqual(index, -1, `${generated} not found in Test.svelte.d.ts`);
                const before = dts.slice(0, index + generated.lastIndexOf('string')).split('\n');

                const original = originalPositionFor(map, {
                    line: before.length,
                    column: before[before.length - 1].length
                });

                assert.strictEqual(original.source, '../src/Test.svelte');
                const line = source_lines[original.line - 1];
                assert.deepStrictEqual(
                    {
                        line,
                        token: line?.slice(original.column, original.column + 'string'.length)
                    },
                    { line: expected_line, token: 'string' },
                    `${generated} maps to ${original.line}:${original.column} of Test.svelte`
                );
            }
        } finally {
            rimraf(declarationDir);
        }
    }).timeout(10000);
});
