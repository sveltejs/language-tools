// @ts-check
/**
 * Regression test for the machine-verbose truncated output bug (https://github.com/sveltejs/language-tools/issues/3013).
 *
 * Usage: node test-flush.js
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-flush-'));
const CLI = path.join(__dirname, 'dist', 'src', 'index.js');
const ITERATIONS = 10;
const N_DIAGS = 1500;

function setupFixture() {
    const refs = [];
    for (let i = 0; i < N_DIAGS; i++) {
        refs.push(`undeclaredIdentifierNumber${i};`);
    }
    const svelte = `<script lang="ts">\n${refs.join('\n')}\n</script>\n`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'Index.svelte'), svelte);

    const tsconfig = {
        compilerOptions: {
            target: 'ESNext',
            moduleResolution: 'node',
            strict: true,
            skipLibCheck: true
        },
        include: ['Index.svelte']
    };
    fs.writeFileSync(path.join(FIXTURE_DIR, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}

/**
 * @returns {Promise<{ code: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string }>}
 */
function runOnce() {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [
                CLI,
                '--workspace',
                FIXTURE_DIR,
                '--tsconfig',
                path.join(FIXTURE_DIR, 'tsconfig.json'),
                '--output',
                'machine-verbose',
                '--threshold',
                'error'
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );

        let stdout = '';
        let stderr = '';

        // Throttle the consumer so the kernel pipe stays full: after each
        // data chunk, pause for 5 ms before resuming. Without this the OS
        // drains the pipe faster than the child writes and the bug is
        // invisible.
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
            child.stdout.pause();
            setTimeout(() => child.stdout.resume(), 5);
        });

        child.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        child.on('error', reject);

        child.on('close', (code, signal) => {
            resolve({ code, signal, stdout, stderr });
        });
    });
}

(async () => {
    console.log('svelte-check stdout-flush regression test\n');
    setupFixture();

    let failures = 0;
    for (let i = 1; i <= ITERATIONS; i++) {
        const { code, stdout, stderr } = await runOnce();
        const lines = stdout.split('\n').filter((l) => l.length > 0);
        const last = lines[lines.length - 1] || '';
        const ok = /^\d+ COMPLETED/.test(last);
        if (ok) {
            console.log(`  PASS: run ${i} (${lines.length} lines)`);
        } else {
            failures++;
            console.log(
                `  FAIL: run ${i} — exit=${code}, lines=${lines.length}, last=${JSON.stringify(
                    last.slice(0, 120)
                )}`
            );
            if (process.env.DEBUG_FLUSH_TEST) {
                console.log('    stderr tail:', stderr.slice(-300));
            }
        }
    }

    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });

    if (failures > 0) {
        console.log(`\n${failures}/${ITERATIONS} runs missing trailing COMPLETED summary`);
        process.exit(1);
    }
    console.log(`\n${ITERATIONS}/${ITERATIONS} runs ended cleanly with COMPLETED summary`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
