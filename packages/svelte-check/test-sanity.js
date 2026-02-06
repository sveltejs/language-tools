// @ts-check
/**
 * Sanity tests for svelte-check.
 * Runs the CLI against test fixtures and verifies expected diagnostics.
 *
 * Usage: node test-sanity.js
 */

const { execFileSync } = require('child_process');
const { rmSync } = require('fs');
const path = require('path');

const CLI = path.join(__dirname, 'dist', 'src', 'index.js');

let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {object} opts
 * @param {string} opts.workspace
 * @param {string} opts.tsconfig
 * @param {boolean} [opts.incremental]
 * @param {number} opts.expectedErrors
 * @param {number[]} [opts.expectedCodes]
 * @param {{line: number, column: number}[]} [opts.expectedLocations]
 */
function test(name, opts) {
    const args = [
        CLI,
        '--workspace',
        opts.workspace,
        '--tsconfig',
        opts.tsconfig,
        '--output',
        'machine-verbose'
    ];
    if (opts.incremental) {
        args.push('--incremental');
    }

    let stdout;
    try {
        stdout = execFileSync('node', args, {
            cwd: __dirname,
            encoding: 'utf-8',
            timeout: 60_000
        });
    } catch (err) {
        // svelte-check exits with code 1 when errors are found; that's expected
        stdout = err.stdout || '';
    }

    const errors = [];
    for (const line of stdout.split('\n')) {
        // Machine-verbose output is JSON after the timestamp
        const jsonStart = line.indexOf('{');
        if (jsonStart === -1) continue;
        try {
            const entry = JSON.parse(line.slice(jsonStart));
            if (entry.type === 'ERROR') {
                errors.push(entry);
            }
        } catch {
            // not a JSON line
        }
    }

    const errorCount = errors.length;
    const errorCodes = errors.map((e) => e.code).sort();

    const issues = [];
    if (errorCount !== opts.expectedErrors) {
        issues.push(`expected ${opts.expectedErrors} errors, got ${errorCount}`);
    }
    if (opts.expectedCodes) {
        const expected = [...opts.expectedCodes].sort();
        if (JSON.stringify(errorCodes) !== JSON.stringify(expected)) {
            issues.push(`expected codes [${expected}], got [${errorCodes}]`);
        }
    }
    if (opts.expectedLocations) {
        const expected = [...opts.expectedLocations].sort();
        const errorLocations = errors.map((e) => ({
            line: e.start.line,
            column: e.start.character
        }));
        if (JSON.stringify(errorLocations) !== JSON.stringify(expected)) {
            issues.push(
                `expected locations [${JSON.stringify(expected)}], got [${JSON.stringify(errorLocations)}]`
            );
        }
    }

    if (issues.length) {
        failed++;
        console.log(`  FAIL: ${name}`);
        for (const issue of issues) {
            console.log(`        ${issue}`);
        }
    } else {
        passed++;
        console.log(`  PASS: ${name}`);
    }
}

console.log('svelte-check sanity tests\n');

test('clean project', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    expectedErrors: 0
});

rmSync('./test-success/.svelte-check', { recursive: true, force: true });
test('clean project (incremental, cold cache)', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    incremental: true,
    expectedErrors: 0
});

test('clean project (incremental, warm cache)', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    incremental: true,
    expectedErrors: 0
});

test('project with errors', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    expectedErrors: 2,
    expectedCodes: [2322, 2367]
});

rmSync('./test-error/.svelte-check', { recursive: true, force: true });
test('project with errors (incremental, cold cache)', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    incremental: true,
    expectedErrors: 2,
    expectedCodes: [2322, 2367],
    expectedLocations: [
        {
            line: 1,
            column: 8
        },
        {
            line: 4,
            column: 4
        }
    ]
});

test('project with errors (incremental, warm cache)', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    incremental: true,
    expectedErrors: 2,
    expectedCodes: [2322, 2367],
    expectedLocations: [
        {
            line: 1,
            column: 8
        },
        {
            line: 4,
            column: 4
        }
    ]
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
