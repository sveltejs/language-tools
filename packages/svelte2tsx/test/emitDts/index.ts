import * as assert from 'assert';
import * as fs from 'fs';
import { join } from 'path';
import { emitDts } from '../../src';

function rimraf(path: string) {
    ((fs as any).rmSync || fs.rmdirSync)(path, { recursive: true, force: true });
}

async function testEmitDts(sample: string) {
    const cwd = join(__dirname, 'samples', sample);

    try {
        const config = fs.existsSync(join(cwd, 'config.json'))
            ? JSON.parse(fs.readFileSync(join(cwd, 'config.json'), 'utf-8'))
            : {};
        await emitDts({
            declarationDir: 'package',
            svelteShimsPath: require.resolve(join(process.cwd(), 'svelte-shims.d.ts')),
            ...config,
            libRoot: config.libRoot ? join(cwd, config.libRoot) : cwd
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
            const expectedContent = fs.readFileSync(join(cwd, 'expected', file), 'utf-8');
            const actualContent = fs.readFileSync(join(cwd, 'package', file), 'utf-8');
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
        it(sample, async () => await testEmitDts(sample)).timeout(5000);
    }
});
