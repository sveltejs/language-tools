// @ts-check
/**
 * Regression test for watch mode rerunning in a loop with --tsgo / --incremental
 * (https://github.com/sveltejs/language-tools/issues/3125).
 *
 * Usage: node test-watch.js
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CLI = path.join(__dirname, 'dist', 'src', 'index.js');
const WORKSPACE = path.join(__dirname, 'test-success');
const SETTLE_MS = 5000;
const WATCHER_READY_MS = 3000;

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} flag
 * @returns {Promise<number>} number of checks that ran after a single file change
 */
async function countRunsAfterChange(flag) {
    fs.rmSync(path.join(WORKSPACE, '.svelte-check'), { recursive: true, force: true });
    const child = spawn(
        process.execPath,
        [CLI, '--workspace', WORKSPACE, '--watch', '--output', 'machine', flag],
        { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    const runs = () => (stdout.match(/ COMPLETED /g) || []).length;

    try {
        const deadline = Date.now() + 60_000;
        while (runs() === 0 && Date.now() < deadline) {
            await sleep(100);
        }
        if (runs() === 0) {
            throw new Error(`no initial run with ${flag}`);
        }
        // The watcher starts after the initial run, give it time to scan the workspace
        await sleep(WATCHER_READY_MS);

        const before = runs();
        const now = new Date();
        fs.utimesSync(path.join(WORKSPACE, 'Index.svelte'), now, now);
        while (runs() === before && Date.now() < deadline) {
            await sleep(100);
        }
        await sleep(SETTLE_MS);
        return runs() - before;
    } finally {
        child.kill();
    }
}

(async () => {
    console.log('svelte-check watch regression test\n');

    let failed = 0;
    for (const flag of ['--tsgo', '--incremental']) {
        const count = await countRunsAfterChange(flag);
        if (count === 1) {
            console.log(`  PASS: ${flag} reran once after a change`);
        } else {
            failed++;
            console.log(`  FAIL: ${flag} reran ${count} times after a change`);
        }
    }

    process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
