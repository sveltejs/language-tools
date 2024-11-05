import * as assert from 'assert';
import * as fs from 'fs';
import { join } from 'path';
import { emitDts } from '../../src';
import { VERSION } from 'svelte/compiler';

function rimraf(path: string) {
    ((fs as any).rmSync || fs.rmdirSync)(path, { recursive: true, force: true });
}

async function testEmitDts(sample: string) {
    const cwd = join(__dirname, 'samples', sample);

    if (sample.endsWith('.v5') && +VERSION[0] < 5) {
        return; // skip
    }

    try {
        const config = fs.existsSync(join(cwd, 'config.json'))
            ? JSON.parse(fs.readFileSync(join(cwd, 'config.json'), 'utf-8'))
            : {};
        await emitDts({
            declarationDir: 'package',
            svelteShimsPath: require.resolve(
                join(
                    process.cwd(),
                    sample.endsWith('.v5') ? 'svelte-shims-v4.d.ts' : 'svelte-shims.d.ts'
                )
            ), // TODO make it -v4 once we have Svelte 4 in the workspace
            ...config,
            libRoot: config.libRoot ? join(cwd, config.libRoot) : join(cwd, 'src')
        });
        const expectedFiles = fs.readdirSync(join(cwd, 'expected'));
        const actual_files = fs.readdirSync(join(cwd, 'package'));
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
                .readFileSync(join(cwd, 'package', file), 'utf-8')
                .replace(/\r\n/g, '\n');
            assert.strictEqual(
                actualContent,
                expectedContent,
                `Expected equal file contents for ${file}`
            );
        }
    } finally {
        rimraf(join(cwd, 'package'));
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
