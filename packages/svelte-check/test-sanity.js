// @ts-check
/**
 * Sanity tests for svelte-check.
 * Runs the CLI against test fixtures and verifies expected diagnostics.
 *
 * Usage: node test-sanity.js
 */

const { execFileSync } = require('child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('fs');
const os = require('os');
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
 * @param {boolean} [opts.tsgoExp]
 * @param {boolean} [opts.tsgo]
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
    if (opts.tsgoExp) {
        args.push('--tsgo-experimental-api');
    }
    if (opts.tsgo) {
        args.push('--tsgo');
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

/**
 * Asserts that a compiler process which dies is reported as a failure rather than as a
 * clean or partial run.
 *
 * @param {string} name
 * @param {string} compilerBody Source of the fake `tsgo` executable written into the workspace.
 */
function testCrashedCompiler(name, compilerBody) {
    // The compiler binary is resolved from the overlay tsconfig that svelte-check writes
    // inside the workspace, so a fake `@typescript/native-preview` in the workspace's
    // node_modules is picked up instead of the real one.
    const crashWorkspace = mkdtempSync(path.join(os.tmpdir(), 'svelte-check-crash-'));
    const tsgoPkg = path.join(crashWorkspace, 'node_modules', '@typescript/native-preview');
    mkdirSync(tsgoPkg, { recursive: true });
    mkdirSync(path.join(crashWorkspace, 'src'));
    writeFileSync(
        path.join(crashWorkspace, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: { target: 'ESNext', moduleResolution: 'bundler', strict: true },
            include: ['src/**/*']
        })
    );
    writeFileSync(
        path.join(crashWorkspace, 'src', 'Test.svelte'),
        '<script lang="ts">\n\tlet { label }: { label: string } = $props();\n</script>\n\n<button>{label}</button>\n'
    );
    writeFileSync(
        path.join(tsgoPkg, 'package.json'),
        JSON.stringify({
            name: '@typescript/native-preview',
            version: '7.0.0',
            bin: { tsgo: './fake-tsgo.js' }
        })
    );
    writeFileSync(path.join(tsgoPkg, 'fake-tsgo.js'), compilerBody);

    let exitCode = 0;
    let stderr = '';
    try {
        execFileSync(
            'node',
            [
                CLI,
                '--workspace',
                crashWorkspace,
                '--tsconfig',
                path.join(crashWorkspace, 'tsconfig.json'),
                '--tsgo',
                '--output',
                'machine-verbose'
            ],
            {
                cwd: __dirname,
                encoding: 'utf-8',
                timeout: 60_000,
                // stderr lands in `err.stderr` either way. Without this it is also forwarded
                // to this process, which prints the crash while the test passes.
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );
    } catch (err) {
        const { status, stderr: errStderr, signal } = /** @type {any} */ (err);
        exitCode = status ?? 0;
        stderr = errStderr || '';
        // Without this a signal-killed svelte-check reports "got exit 0", which sends the
        // next person looking in the wrong place.
        if (signal) {
            stderr += ` (svelte-check itself was killed by signal ${signal})`;
        }
    }

    // The message differs by platform: a kill arrives as a signal on POSIX and as an exit
    // code on Windows, so accept either way of reporting the failed compiler process.
    if (
        exitCode !== 0 &&
        /The TypeScript compiler process (was killed by signal|exited with code)/.test(stderr)
    ) {
        passed++;
        console.log(`  PASS: ${name}`);
    } else {
        failed++;
        console.log(`  FAIL: ${name}`);
        console.log(
            `        expected a non-zero exit and a compiler process error, got exit ${exitCode} and stderr ${JSON.stringify(
                stderr
            )}`
        );
    }

    rmSync(crashWorkspace, { recursive: true, force: true });
}

console.log('svelte-check sanity tests\n');

test('clean project', {
    workspace: './test-success',
    tsconfig: './tsconfig.json'
});

test('clean project --tsgo-experimental-api', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    tsgoExp: true
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

test('clean project --tsgo', {
    workspace: './test-success',
    tsconfig: './tsconfig.json',
    tsgo: true
});

const errors = [
    {
        file: 'Index.svelte',
        line: 3,
        column: 21,
        code: 2307
    },
    {
        file: 'Index.svelte',
        line: 5,
        column: 8,
        code: 2322
    },
    {
        file: 'Index.svelte',
        line: 8,
        column: 4,
        code: 2367
    },
    {
        file: 'Index.svelte',
        line: 11,
        column: 4,
        code: 2367
    },
    {
        file: 'Index.svelte',
        line: 15,
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

test('project with errors --tsgo-experimental-api', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    tsgoExp: true,
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

test('project with errors --tsgo', {
    workspace: './test-error',
    tsconfig: './tsconfig.json',
    tsgo: true,
    errors
});

// Without an `include` or `files`, TypeScript checks every file next to the tsconfig. The
// overlay tsconfig used by --incremental / --tsgo must not narrow that down to nothing.
const noIncludeErrors = [
    { file: 'other/b.ts', line: 0, column: 13, code: 2322 },
    { file: 'src/App.svelte', line: 1, column: 10, code: 2322 },
    { file: 'src/a.ts', line: 0, column: 13, code: 2322 }
];

test('project without include', {
    workspace: './test-no-include',
    tsconfig: './tsconfig.json',
    errors: noIncludeErrors
});

rmSync('./test-no-include/.svelte-check', { recursive: true, force: true });
test('project without include (incremental)', {
    workspace: './test-no-include',
    tsconfig: './tsconfig.json',
    incremental: true,
    errors: noIncludeErrors
});

test('project without include --tsgo', {
    workspace: './test-no-include',
    tsconfig: './tsconfig.json',
    tsgo: true,
    errors: noIncludeErrors
});

// An `include` inherited through `extends` still applies, so `other/b.ts` is not checked.
const inheritedIncludeErrors = noIncludeErrors.filter((error) => error.file.startsWith('src/'));

rmSync('./test-no-include/.svelte-check', { recursive: true, force: true });
test('project with include from extends (incremental)', {
    workspace: './test-no-include',
    tsconfig: './tsconfig.extends.json',
    incremental: true,
    errors: inheritedIncludeErrors
});

test('project with include from extends --tsgo', {
    workspace: './test-no-include',
    tsconfig: './tsconfig.extends.json',
    tsgo: true,
    errors: inheritedIncludeErrors
});

// A compiler that dies must not look like a clean run, and one that dies after reporting
// some diagnostics must not look like a completed one.
testCrashedCompiler(
    'crashed compiler is reported as a failure',
    "process.kill(process.pid, 'SIGKILL');\n"
);

// The same failure without a signal, which is how Windows reports every kill.
testCrashedCompiler(
    'compiler exiting without output is reported as a failure',
    'process.exit(1);\n'
);

// Windows reports a kill as an exit code and never as a signal, so the signal branch is
// unreachable there and this case would resolve with its partial diagnostic instead.
if (process.platform !== 'win32') {
    testCrashedCompiler(
        'crash after reporting a diagnostic is still a failure',
        "process.stdout.write('src/Test.svelte:1:1 - error TS2322: Type mismatch.\\n');\nprocess.kill(process.pid, 'SIGKILL');\n"
    );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
