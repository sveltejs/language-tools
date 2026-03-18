import * as assert from 'assert';
import * as fs from 'fs';
import { join, relative, sep } from 'path';
import { emitDts } from '../../src';
import { VERSION } from 'svelte/compiler';

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

async function testEmitDts(sample: string) {
    const cwd = join(__dirname, 'samples', sample);

    if (sample.endsWith('.v5') && +VERSION[0] < 5) {
        return; // skip
    }

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
            svelteShimsPath: require.resolve(
                join(
                    process.cwd(),
                    sample.endsWith('.v5') ? 'svelte-shims-v4.d.ts' : 'svelte-shims.d.ts'
                )
            ), // TODO make it -v4 once we have Svelte 4 in the workspace
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
        it(sample, async () => await testEmitDts(sample)).timeout(10000);
    }
});
