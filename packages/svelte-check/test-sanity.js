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
 * @typedef {object} ExpectedError
 * @property {string} file
 * @property {number} line
 * @property {number} column
 * @property {number} code
 */

/**
 * @param {string} name
 * @param {object} opts
 * @param {string} opts.workspace
 * @param {string} opts.tsconfig
 * @param {boolean} [opts.incremental]
 * @param {ExpectedError[]} [opts.errors]
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
        stdout = /** @type {any} */ (err).stdout || '';
    }

    const errors = [];
    for (const line of stdout.split('\n')) {
        // Machine-verbose output is JSON after the timestamp
        const jsonStart = line.indexOf('{');
        if (jsonStart === -1) continue;
        try {
            const entry = JSON.parse(line.slice(jsonStart));
            if (entry.type === 'ERROR') {
                errors.push({
                    file: entry.filename.replace(/\\/g, '/'),
                    line: entry.start.line,
                    column: entry.start.character,
                    code: entry.code
                });
            }
        } catch {
            // not a JSON line
        }
    }

    const issues = [];
    const expectedErrors = opts.errors || [];

    if (errors.length !== expectedErrors.length) {
        issues.push(`expected ${expectedErrors.length} errors, got ${errors.length}`);
    }

    if (expectedErrors.length > 0) {
        /** @param {any} a @param {any} b */
        const sortErrors = (a, b) => {
            if (a.file !== b.file) return a.file.localeCompare(b.file);
            if (a.line !== b.line) return a.line - b.line;
            if (a.column !== b.column) return a.column - b.column;
            return a.code - b.code;
        };

        const sortedExpected = [...expectedErrors].sort(sortErrors);
        const sortedActual = [...errors].sort(sortErrors);

        if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
            issues.push(
                `expected errors:\n${JSON.stringify(sortedExpected, null, 2)}\n` +
                    `got errors:\n${JSON.stringify(sortedActual, null, 2)}`
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
    tsconfig: './tsconfig.json'
});

rmSync('./test-success/.svelte-check', { recursive: true, force: true });
test('clean project (incremental, cold cache)', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    incremental: true
});

test('clean project (incremental, warm cache)', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    incremental: true
});

const errors = [
    {
        file: 'Index.svelte',
        line: 4,
        column: 8,
        code: 2322
    },
    {
        file: 'Index.svelte',
        line: 7,
        column: 4,
        code: 2367
    },
    {
        file: 'Index.svelte',
        line: 10,
        column: 4,
        code: 2367
    },
    {
        file: 'Index.svelte',
        line: 14,
        column: 1,
        code: 2741
    },
    {
        file: 'Jsdoc.svelte',
        line: 9,
        column: 23,
        code: 2322
    },
    {
        file: 'src/routes/+page.ts',
        line: 0,
        column: 13,
        code: 2322
    }
];

test('project with errors', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    errors
});

rmSync('./test-error/.svelte-check', { recursive: true, force: true });
test('project with errors (incremental, cold cache)', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    incremental: true,
    errors
});

test('project with errors (incremental, warm cache)', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    incremental: true,
    errors
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
