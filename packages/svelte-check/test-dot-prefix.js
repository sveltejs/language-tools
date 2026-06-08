// @ts-check
/**
 * Regression test for https://github.com/sveltejs/language-tools/issues/3034.
 *
 * findFiles() used `filePath.includes('/.')` to skip hidden directories,
 * which also matched ancestor directories of the workspace whose names
 * started with a dot. The result was that every subdirectory of the
 * workspace was excluded when the workspace lived under any dot-prefixed
 * ancestor (e.g. `.local/`, `.config/`, custom worktree directories).
 *
 * The user-visible effect was that svelte-check emitted zero virtual
 * `.svelte.d.ts` shim files - the cache directory ended up with only the
 * overlay tsconfig.json. This regression test asserts the inverse:
 * running svelte-check against a workspace whose absolute path passes
 * through a dot-prefixed ancestor still emits the shim for any
 * descendant .svelte file.
 *
 * Usage: node test-dot-prefix.js
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, 'dist', 'src', 'index.js');

const PARENT = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-dot-parent-'));
const DOT_ANCESTOR = path.join(PARENT, '.dotted');
fs.mkdirSync(DOT_ANCESTOR, { recursive: true });
const WORKSPACE = fs.mkdtempSync(path.join(DOT_ANCESTOR, 'ws-'));

function setupFixture() {
    const srcDir = path.join(WORKSPACE, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    const svelte = '<script lang="ts">\n    const n: number = 1;\n</script>\n';
    fs.writeFileSync(path.join(srcDir, 'Index.svelte'), svelte);

    const tsconfig = {
        compilerOptions: {
            target: 'ESNext',
            moduleResolution: 'node',
            strict: true,
            skipLibCheck: true
        },
        include: ['src/**/*.svelte']
    };
    fs.writeFileSync(path.join(WORKSPACE, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}

setupFixture();

const result = spawnSync(
    process.execPath,
    [
        CLI,
        '--workspace',
        WORKSPACE,
        '--tsconfig',
        path.join(WORKSPACE, 'tsconfig.json'),
        '--output',
        'machine',
        '--threshold',
        'error',
        // incremental mode is what drives emitSvelteFiles(), which in turn
        // calls findFiles(). Without it the regression cannot be observed.
        '--incremental'
    ],
    { encoding: 'utf8' }
);

// findFiles() drives the emit step in incremental.ts. With the original
// bug it returned an empty list when the workspace had a dot-prefixed
// ancestor, so no Index.svelte shim landed in the cache directory.
const cacheRoot = path.join(WORKSPACE, '.svelte-check', 'svelte');
const expectedShim = path.join(cacheRoot, 'src', 'Index.d.svelte.ts');

let emitted = false;
try {
    emitted = fs.existsSync(expectedShim);
} catch {
    emitted = false;
}

fs.rmSync(PARENT, { recursive: true, force: true });

if (!emitted) {
    console.error('FAIL: svelte-check did not emit the Svelte shim for a workspace under a dot-prefixed ancestor');
    console.error('  expected shim:', expectedShim);
    console.error('  stdout tail:', result.stdout.slice(-400));
    console.error('  stderr tail:', result.stderr.slice(-400));
    process.exit(1);
}

console.log('PASS: svelte-check emits Svelte shims under a workspace whose ancestor name starts with a dot');
