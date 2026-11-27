// @ts-check
/**
 * Tests for svelte-check's TypeScript 7 path (`--experimental-ts7`): TypeScript 7.1 with the Svelte
 * content mapper (`@sveltejs/ts-content-mapper`).
 *
 * The fixtures are copied to temporary directories with their own node_modules (TypeScript 7.1 as
 * `typescript`, the content mapper, Svelte 5) and a tsconfig with the `contentMappers` entry. The
 * results are compared with today's TypeScript 6 svelte-check on the original fixtures; the
 * differences we know about are listed below, each with its reason.
 *
 * Needs the built content mapper (`pnpm build` at the repo root) and Svelte 5.
 *
 * Usage: node test-ts7.js [--verbose]
 *   --verbose  also prints the failure messages of the failure-mode tests
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The svelte-check processes started here inherit this environment. A `NODE_PATH` from the caller
// (pnpm's `.bin` shims set one with the hoisted `node_modules/.pnpm/node_modules`) would let them
// find packages that the test workspaces deliberately don't have, such as TypeScript 7.1.
delete process.env.NODE_PATH;

const CLI = path.join(__dirname, 'dist', 'src', 'index.js');
const CONTENT_MAPPER = '@sveltejs/ts-content-mapper';
const verbose = process.argv.includes('--verbose');

/** @param {string} packageName */
function packageDir(packageName) {
    return fs.realpathSync(path.dirname(require.resolve(`${packageName}/package.json`)));
}

const packages = {
    typescript71: packageDir('@typescript/native'),
    typescript6: packageDir('typescript'),
    contentMapper: packageDir(CONTENT_MAPPER),
    svelte: packageDir('svelte')
};

/**
 * Differences from TypeScript 6 svelte-check that are expected. `ts6Only`: TS6 reports it, the TS7
 * path doesn't. `ts7Only`: the other way round.
 *
 * @typedef {{ file: string, line: number, column: number, code: number | string, type: 'ERROR' | 'WARNING', reason: string }} KnownDifference
 */

const KIT_IMPLICIT_TYPING =
    "SvelteKit's implicit typing of route/hooks files isn't supported in the TS7 path yet (the content mapper only handles .svelte)";

/** @type {Record<string, { ts6Only?: KnownDifference[], ts7Only?: KnownDifference[] }>} */
const knownDifferences = {
    'test-error': {
        ts6Only: [
            {
                file: 'src/routes/+page.ts',
                line: 0,
                column: 13,
                code: 2322,
                type: 'ERROR',
                reason: KIT_IMPLICIT_TYPING
            }
        ]
    },
    'test-success': {
        ts7Only: [
            {
                file: 'src/hooks.server.ts',
                line: 0,
                column: 25,
                code: 7031,
                type: 'ERROR',
                reason: KIT_IMPLICIT_TYPING
            },
            {
                file: 'src/hooks.server.ts',
                line: 0,
                column: 32,
                code: 7031,
                type: 'ERROR',
                reason: KIT_IMPLICIT_TYPING
            },
            {
                file: 'src/routes/+server.ts',
                line: 0,
                column: 28,
                code: 7031,
                type: 'ERROR',
                reason: KIT_IMPLICIT_TYPING
            },
            {
                file: 'src/routes/+server.ts',
                line: 4,
                column: 29,
                code: 7031,
                type: 'ERROR',
                reason: KIT_IMPLICIT_TYPING
            }
        ]
    }
};

let passed = 0;
let failed = 0;
const temporaryDirectories = [];

/**
 * A TypeScript package with only a package.json. Enough for the version checks, which reject it
 * before loading anything.
 *
 * @param {string} version
 */
function createFakeTypeScript(version) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-typescript-'));
    temporaryDirectories.push(dir);
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'typescript', version, bin: { tsc: './bin/tsc' } })
    );
    return dir;
}

/**
 * @param {string} name
 * @param {() => string[]} check returns the problems
 */
function test(name, check) {
    let issues;
    try {
        issues = check();
    } catch (error) {
        issues = [String(/** @type {any} */ (error)?.stack ?? error)];
    }
    report(name, issues);
}

/**
 * @param {string} name
 * @param {() => Promise<string[]>} check returns the problems
 */
async function testAsync(name, check) {
    let issues;
    try {
        issues = await check();
    } catch (error) {
        issues = [String(/** @type {any} */ (error)?.stack ?? error)];
    }
    report(name, issues);
}

/**
 * @param {string} name
 * @param {string[]} issues
 */
function report(name, issues) {
    if (issues.length) {
        failed++;
        console.log(`  FAIL: ${name}`);
        for (const issue of issues) {
            console.log(`        ${issue.replace(/\n/g, '\n        ')}`);
        }
    } else {
        passed++;
        console.log(`  PASS: ${name}`);
    }
}

/**
 * A temporary workspace with node_modules links and a tsconfig.
 *
 * @param {object} options
 * @param {string} [options.fixture] directory to copy
 * @param {Record<string, any>} [options.tsconfig] defaults to the fixture's tsconfig
 * @param {boolean} [options.contentMappers] add the `contentMappers` entry for the content mapper
 * @param {string | null} [options.typescript] linked as `typescript`
 * @param {Record<string, string | null>} [options.links] more node_modules links
 * @param {Record<string, string>} [options.files] more files
 */
function createWorkspace({
    fixture,
    tsconfig,
    contentMappers = true,
    typescript = packages.typescript71,
    links = {},
    files = {}
}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-'));
    temporaryDirectories.push(dir);
    if (fixture) {
        fs.cpSync(fixture, dir, {
            recursive: true,
            filter: (source) => !/[\\/](\.svelte-check|node_modules)$/.test(source)
        });
        tsconfig ??= readJsonc(path.join(fixture, 'tsconfig.json'));
    }
    const config = { ...tsconfig };
    if (contentMappers) {
        config.contentMappers = [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }];
    }
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(config, null, 4));

    const allLinks = {
        typescript,
        svelte: packages.svelte,
        [CONTENT_MAPPER]: packages.contentMapper,
        ...links
    };
    for (const [name, target] of Object.entries(allLinks)) {
        if (target) {
            const link = path.join(dir, 'node_modules', name);
            fs.mkdirSync(path.dirname(link), { recursive: true });
            fs.symlinkSync(target, link, 'junction');
        }
    }
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
}

/**
 * tsconfig files are JSON with comments and trailing commas
 *
 * @param {string} file
 */
function readJsonc(file) {
    const text = fs.readFileSync(file, 'utf-8');
    let json = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            const end = findStringEnd(text, i);
            json += text.slice(i, end + 1);
            i = end;
        } else if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            json += '\n';
        } else if (char === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i + 2) + 1;
        } else {
            json += char;
        }
    }
    return JSON.parse(json.replace(/,(\s*[}\]])/g, '$1'));
}

/** @param {string} text @param {number} start index of the opening quote */
function findStringEnd(text, start) {
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === '\\') {
            i++;
        } else if (text[i] === '"') {
            return i;
        }
    }
    return text.length;
}

/**
 * @param {string} workspace
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string[]} [options.nodeArgs]
 */
function runSvelteCheck(workspace, { args = [], env = process.env, nodeArgs = [] } = {}) {
    const result = spawnSync(
        process.execPath,
        [
            ...nodeArgs,
            CLI,
            '--workspace',
            workspace,
            '--tsconfig',
            './tsconfig.json',
            '--output',
            'machine-verbose',
            ...args
        ],
        { cwd: __dirname, encoding: 'utf-8', timeout: 120_000, env }
    );
    const entries = [];
    let failure;
    for (const line of result.stdout.split('\n')) {
        const parsed = parseOutputLine(line);
        if (parsed?.kind === 'failure') {
            failure = parsed.message;
        } else if (parsed?.kind === 'entry') {
            entries.push(parsed.entry);
        }
    }
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        entries,
        failure
    };
}

/**
 * One line of `--output machine-verbose`
 *
 * @param {string} line
 */
function parseOutputLine(line) {
    const content = line.replace(/^\d+ /, '');
    if (content.startsWith('START ')) {
        return /** @type {const} */ ({ kind: 'start' });
    }
    if (content.startsWith('COMPLETED ')) {
        return /** @type {const} */ ({ kind: 'completed', summary: content });
    }
    if (content.startsWith('FAILURE ')) {
        return /** @type {const} */ ({
            kind: 'failure',
            message: /** @type {string} */ (JSON.parse(content.slice('FAILURE '.length)))
        });
    }
    if (content.startsWith('{')) {
        const entry = JSON.parse(content);
        return /** @type {const} */ ({
            kind: 'entry',
            entry: {
                file: /** @type {string} */ (entry.filename).replace(/\\/g, '/'),
                line: /** @type {number} */ (entry.start.line),
                column: /** @type {number} */ (entry.start.character),
                code: /** @type {number | string} */ (entry.code),
                type: /** @type {'ERROR' | 'WARNING'} */ (entry.type),
                message: /** @type {string} */ (entry.message)
            }
        });
    }
    return undefined;
}

/**
 * svelte-check --watch, run in the background. `nextRun` waits for the next check to finish.
 *
 * @typedef {{ entries: ReturnType<typeof runSvelteCheck>['entries'], failure?: string }} WatchRun
 */
class WatchedSvelteCheck {
    /** @param {string} workspace */
    constructor(workspace) {
        this.child = spawn(
            process.execPath,
            [
                CLI,
                '--workspace',
                workspace,
                '--tsconfig',
                './tsconfig.json',
                '--output',
                'machine-verbose',
                '--watch',
                '--experimental-ts7'
            ],
            { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }
        );
        /** @type {WatchRun[]} */
        this.runs = [];
        /** @type {WatchRun['entries']} */
        this.entries = [];
        this.stderr = '';
        /** @type {(() => void) | undefined} */
        this.notify = undefined;
        this.returnedRuns = 0;
        let buffer = '';
        this.child.stdout.setEncoding('utf-8').on('data', (/** @type {string} */ chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                this.handleLine(line);
            }
        });
        this.child.stderr.setEncoding('utf-8').on('data', (chunk) => (this.stderr += chunk));
        this.child.on('exit', () => this.notify?.());
    }

    /** @param {string} line */
    handleLine(line) {
        const parsed = parseOutputLine(line);
        if (parsed?.kind === 'start') {
            this.entries = [];
        } else if (parsed?.kind === 'entry') {
            this.entries.push(parsed.entry);
        } else if (parsed?.kind === 'completed' || parsed?.kind === 'failure') {
            this.runs.push({
                entries: this.entries,
                failure: parsed.kind === 'failure' ? parsed.message : undefined
            });
            this.entries = [];
            this.notify?.();
        }
    }

    /**
     * The result of the next check (after the ones already returned)
     *
     * @param {number} [timeout]
     * @returns {Promise<WatchRun>}
     */
    async nextRun(timeout = 60_000) {
        const index = this.returnedRuns + 1;
        const deadline = Date.now() + timeout;
        while (this.runs.length < index) {
            if (this.child.exitCode !== null || this.child.signalCode !== null) {
                throw new Error(`svelte-check exited (${this.child.exitCode}):\n${this.stderr}`);
            }
            if (Date.now() > deadline) {
                throw new Error(`no check within ${timeout} ms:\n${this.stderr}`);
            }
            await new Promise((resolve) => {
                this.notify = () => resolve(undefined);
                setTimeout(resolve, 200);
            });
        }
        this.returnedRuns = index;
        return this.runs[index - 1];
    }

    stop() {
        this.child.kill();
    }
}

/** @param {{ file: string, line: number, column: number, code: number | string, type: string }} entry */
function key(entry) {
    return `${entry.file}:${entry.line}:${entry.column} ${entry.code} ${entry.type}`;
}

/**
 * Runs TS6 svelte-check on the fixture and the TS7 path on a copy, and compares
 * (file, line, column, code, severity) of all errors and warnings.
 *
 * @param {string} name fixture directory next to this file
 */
function compareWithTypeScript6(name) {
    const fixture = path.join(__dirname, name);
    const ts6 = runSvelteCheck(fixture);
    const ts7 = runSvelteCheck(createWorkspace({ fixture }), { args: ['--experimental-ts7'] });
    if (ts7.failure || ts7.status === null) {
        return [`TS7 run failed: ${ts7.failure ?? ts7.stderr}`];
    }

    const known = knownDifferences[name] ?? {};
    const ts6Keys = new Set(ts6.entries.map(key));
    const ts7Keys = new Set(ts7.entries.map(key));
    const issues = [];
    for (const difference of known.ts6Only ?? []) {
        if (!ts6Keys.has(key(difference)) || ts7Keys.has(key(difference))) {
            issues.push(`known difference no longer applies, remove it: ${key(difference)}`);
        }
    }
    for (const difference of known.ts7Only ?? []) {
        if (ts6Keys.has(key(difference)) || !ts7Keys.has(key(difference))) {
            issues.push(`known difference no longer applies, remove it: ${key(difference)}`);
        }
    }
    const knownKeys = new Set([...(known.ts6Only ?? []), ...(known.ts7Only ?? [])].map(key));
    for (const entry of ts6.entries) {
        if (!ts7Keys.has(key(entry)) && !knownKeys.has(key(entry))) {
            issues.push(`only TS6: ${key(entry)} ${entry.message}`);
        }
    }
    for (const entry of ts7.entries) {
        if (!ts6Keys.has(key(entry)) && !knownKeys.has(key(entry))) {
            issues.push(`only TS7: ${key(entry)} ${entry.message}`);
        }
    }
    const expectedExit = ts7.entries.some((entry) => entry.type === 'ERROR') ? 1 : 0;
    if (ts7.status !== expectedExit) {
        issues.push(`expected exit code ${expectedExit}, got ${ts7.status}`);
    }
    return issues;
}

/**
 * The run must fail (exit code 1) with a failure message matching all patterns.
 *
 * @param {ReturnType<typeof runSvelteCheck>} result
 * @param {RegExp[]} patterns
 */
function expectFailure(result, patterns) {
    if (verbose && result.failure) {
        console.log(`        ${result.failure.replace(/\n/g, '\n        ')}`);
    }
    const issues = [];
    if (result.status !== 1) {
        issues.push(`expected exit code 1, got ${result.status}`);
    }
    if (!result.failure) {
        issues.push(`expected a FAILURE line, got:\n${result.stdout}\n${result.stderr}`);
        return issues;
    }
    for (const pattern of patterns) {
        if (!pattern.test(result.failure)) {
            issues.push(`failure message doesn't match ${pattern}:\n${result.failure}`);
        }
    }
    return issues;
}

/**
 * A content mapper package that speaks the protocol just enough to start, and then fails every
 * transform (or can't be started at all, with `exec` pointing to a missing command).
 *
 * @param {string[]} exec
 */
function fakeContentMapper(exec) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-mapper-'));
    temporaryDirectories.push(dir);
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
            name: 'fake-content-mapper',
            version: '1.0.0',
            typescript: { contentMapper: { exec } }
        })
    );
    fs.writeFileSync(
        path.join(dir, 'server.js'),
        `let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
        const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
        if (headerEnd === -1) return;
        const length = Number(/Content-Length: (\\d+)/i.exec(buffer.subarray(0, headerEnd).toString())[1]);
        if (buffer.length < headerEnd + 4 + length) return;
        const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString());
        buffer = buffer.subarray(headerEnd + 4 + length);
        if (message.id === undefined) continue;
        const response = message.method === 'initialize'
            ? { result: { positionEncoding: 'utf-16', diagnosticSource: 'svelte' } }
            : message.method === 'transform'
              ? { error: { code: -32603, message: 'fake content mapper failure' } }
              : { result: {} };
        const body = JSON.stringify({ jsonrpc: '2.0', id: message.id, ...response });
        process.stdout.write('Content-Length: ' + Buffer.byteLength(body) + '\\r\\n\\r\\n' + body);
    }
});
`
    );
    return dir;
}

const simpleTsconfig = {
    compilerOptions: {
        strict: true,
        moduleResolution: 'bundler',
        target: 'esnext',
        skipLibCheck: true
    },
    include: ['**/*']
};

/** A `bind:` on a prop that isn't `$bindable()`: the error starts in generated code */
const bindToNonBindableProp = {
    'Child.svelte':
        '<script lang="ts">\n\tlet { value }: { value: string } = $props();\n</script>\n\n<p>{value}</p>\n',
    'Parent.svelte':
        '<script lang="ts">\n\timport Child from "./Child.svelte";\n\tlet text = $state("a");\n</script>\n\n<Child bind:value={text} />\n'
};

/**
 * Runs the TS7 path and records whether svelte-check's process loaded the `typescript` package
 * itself: TypeScript 6's `lib/typescript.js`, or the main entry of any `typescript` (TypeScript 7's
 * is only a version stub). Its API modules (`typescript/async`, `typescript/ast`) are fine.
 *
 * @param {string} workspace
 * @returns {{ result: ReturnType<typeof runSvelteCheck>, loaded: string[] | undefined }}
 */
function runRecordingTypeScriptLoads(workspace) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-hook-'));
    temporaryDirectories.push(directory);
    const marker = path.join(directory, 'modules.json');
    const hook = path.join(directory, 'hook.cjs');
    fs.writeFileSync(
        hook,
        `const Module = require('module');
const loaded = new Set();
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    const resolved = resolveFilename.call(this, request, ...rest);
    if (request === 'typescript') loaded.add(resolved);
    return resolved;
};
process.on('exit', () => {
    for (const file of Object.keys(require.cache)) {
        if (/[\\\\/]typescript[\\\\/]lib[\\\\/]typescript\\.js$/.test(file)) loaded.add(file);
    }
    require('fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify([...loaded]));
});
`
    );
    const result = runSvelteCheck(workspace, {
        args: ['--experimental-ts7'],
        nodeArgs: ['--require', hook]
    });
    return {
        result,
        loaded: fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, 'utf-8')) : undefined
    };
}

/**
 * A content mapper package that records the environment the real content mapper is started
 * with, and then runs it. Its manifest is the real one (`extensions`, `dynamicConfig`, ...), only
 * `exec` starts the recording wrapper.
 *
 * @returns {{ dir: string, recorded: () => { typescript: string | null } | undefined }}
 */
function recordingContentMapper() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-mapper-'));
    temporaryDirectories.push(dir);
    const record = path.join(dir, 'environment.json');
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
            name: 'recording-content-mapper',
            version: '1.0.0',
            type: 'module',
            typescript: {
                contentMapper: {
                    ...require(path.join(packages.contentMapper, 'package.json')).typescript
                        .contentMapper,
                    exec: ['node', 'server.js']
                }
            }
        })
    );
    fs.writeFileSync(
        path.join(dir, 'server.js'),
        `import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ typescript: process.env.SVELTE_CONTENT_MAPPER_TYPESCRIPT ?? null }));
await import(${JSON.stringify(require('url').pathToFileURL(path.join(packages.contentMapper, 'dist', 'server.js')).href)});
`
    );
    return {
        dir,
        recorded: () =>
            fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf-8')) : undefined
    };
}

/**
 * `--watch`: one long-running svelte-check, files changed step by step. Each step checks the
 * (file, code, severity) of all errors and warnings of the next run.
 */
async function testWatchMode() {
    const workspace = createWorkspace({
        tsconfig: simpleTsconfig,
        files: {
            'Counter.svelte':
                '<script lang="ts">\n\timport { initial } from "./values";\n\tlet count: number = initial;\n</script>\n\n<button onclick={() => count++}>{count}</button>\n',
            // 7006 with `strict`
            'values.ts':
                'export const initial: number = 0;\nexport function double(x) { return x * 2; }\n'
        }
    });
    /** @param {string} name @param {string} content */
    const write = (name, content) => fs.writeFileSync(path.join(workspace, name), content);
    /** @param {WatchRun} run */
    const keys = (run) =>
        run.failure
            ? [`FAILURE ${run.failure}`]
            : run.entries.map((entry) => `${entry.file} ${entry.code} ${entry.type}`).sort();

    /** @type {Array<{ name: string, change?: () => void, expected: (string | RegExp)[] }>} */
    const steps = [
        { name: 'first check', expected: ['values.ts 7006 ERROR'] },
        {
            name: 'a changed .ts file affects the Svelte file importing it',
            change: () =>
                write(
                    'values.ts',
                    'export const initial: string = "0";\nexport function double(x) { return x * 2; }\n'
                ),
            expected: ['Counter.svelte 2322 ERROR', 'values.ts 7006 ERROR']
        },
        {
            name: 'a new Svelte file is part of the program (include), with Svelte diagnostics',
            change: () =>
                write(
                    'Broken.svelte',
                    '<script lang="ts">\n\tconst n: number = "x";\n</script>\n\n<img src="x.png" />{n}\n'
                ),
            expected: [
                'Broken.svelte 2322 ERROR',
                'Broken.svelte a11y_missing_attribute WARNING',
                'Counter.svelte 2322 ERROR',
                'values.ts 7006 ERROR'
            ]
        },
        {
            name: 'a changed Svelte file is transformed and compiled again',
            change: () =>
                write(
                    'Counter.svelte',
                    '<script lang="ts">\n\timport { initial } from "./values";\n\tlet count: number = Number(initial);\n</script>\n\n<img src="y.png" />\n<button onclick={() => count++}>{count}</button>\n'
                ),
            expected: [
                'Broken.svelte 2322 ERROR',
                'Broken.svelte a11y_missing_attribute WARNING',
                'Counter.svelte a11y_missing_attribute WARNING',
                'values.ts 7006 ERROR'
            ]
        },
        {
            name: 'a deleted Svelte file is gone',
            change: () => fs.rmSync(path.join(workspace, 'Broken.svelte')),
            expected: ['Counter.svelte a11y_missing_attribute WARNING', 'values.ts 7006 ERROR']
        },
        {
            name: 'a changed tsconfig reloads the project',
            change: () =>
                write(
                    'tsconfig.json',
                    JSON.stringify({
                        ...simpleTsconfig,
                        compilerOptions: { ...simpleTsconfig.compilerOptions, strict: false },
                        contentMappers: [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }]
                    })
                ),
            expected: ['Counter.svelte a11y_missing_attribute WARNING']
        },
        {
            name: 'a deleted tsconfig is a failure',
            change: () => fs.rmSync(path.join(workspace, 'tsconfig.json')),
            expected: [/^FAILURE TypeScript could not load .*tsconfig\.json$/]
        },
        {
            name: 'the tsconfig is back',
            change: () =>
                write(
                    'tsconfig.json',
                    JSON.stringify({
                        ...simpleTsconfig,
                        contentMappers: [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }]
                    })
                ),
            expected: ['Counter.svelte a11y_missing_attribute WARNING', 'values.ts 7006 ERROR']
        }
    ];

    const svelteCheck = new WatchedSvelteCheck(workspace);
    try {
        for (const [index, step] of steps.entries()) {
            if (step.change) {
                step.change();
            }
            await testAsync(`--watch: ${step.name}`, async () => {
                const actual = keys(await svelteCheck.nextRun());
                const matches =
                    actual.length === step.expected.length &&
                    step.expected.every((expected, i) =>
                        typeof expected === 'string'
                            ? actual[i] === expected
                            : expected.test(actual[i])
                    );
                return matches
                    ? []
                    : [
                          `expected:\n  ${step.expected.join('\n  ')}\ngot:\n  ${actual.join('\n  ')}`
                      ];
            });
            if (index === 0) {
                // let the file watcher finish its initial scan
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    } finally {
        svelteCheck.stop();
    }
}

/**
 * `--watch` with project references: a referenced tsconfig deleted and created again, next to a
 * second referenced project, and a reference removed.
 */
async function testWatchModeReferences() {
    const project = {
        ...simpleTsconfig,
        include: ['src/**/*'],
        contentMappers: [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }]
    };
    const workspace = createWorkspace({
        tsconfig: { files: [], references: [{ path: './app' }, { path: './good' }] },
        contentMappers: false,
        files: {
            'app/tsconfig.json': JSON.stringify(project),
            'app/src/App.svelte': '<p>app</p>\n',
            // 7006 with `strict`
            'app/src/file.ts': 'export function f(x) { return x; }\n',
            'good/tsconfig.json': JSON.stringify(project),
            'good/src/Good.svelte':
                '<script lang="ts">\n\tconst n: number = "x";\n</script>\n\n<p>{n}</p>\n'
        }
    });
    /** @param {string} name @param {string} content */
    const write = (name, content) => fs.writeFileSync(path.join(workspace, name), content);
    /** @param {WatchRun} run */
    const keys = (run) =>
        run.failure
            ? [`FAILURE ${run.failure}`]
            : run.entries.map((entry) => `${entry.file} ${entry.code} ${entry.type}`).sort();
    const both = ['app/src/file.ts 7006 ERROR', 'good/src/Good.svelte 2322 ERROR'];

    /** @type {Array<{ name: string, change?: () => void, expected: (string | RegExp)[] }>} */
    const steps = [
        { name: 'first check, both referenced projects', expected: both },
        {
            name: 'a deleted referenced tsconfig is a failure',
            change: () => fs.rmSync(path.join(workspace, 'app', 'tsconfig.json')),
            expected: [/^FAILURE TypeScript could not load .*app[\\/]tsconfig\.json, which/]
        },
        {
            name: 'the referenced tsconfig is back',
            change: () => write('app/tsconfig.json', JSON.stringify(project)),
            expected: both
        },
        {
            name: 'a changed file of the restored project',
            change: () =>
                write(
                    'app/src/file.ts',
                    'export function f(x) { return x; }\nexport const s: string = 1;\n'
                ),
            expected: ['app/src/file.ts 2322 ERROR', ...both].sort()
        },
        {
            name: 'a reference removed from the root tsconfig',
            change: () =>
                write(
                    'tsconfig.json',
                    JSON.stringify({ files: [], references: [{ path: './good' }] })
                ),
            // app/src/App.svelte isn't included by any tsconfig now
            expected: ['good/src/Good.svelte 2322 ERROR']
        }
    ];

    const svelteCheck = new WatchedSvelteCheck(workspace);
    try {
        for (const [index, step] of steps.entries()) {
            if (step.change) {
                step.change();
            }
            await testAsync(`--watch with references: ${step.name}`, async () => {
                const actual = keys(await svelteCheck.nextRun());
                const matches =
                    actual.length === step.expected.length &&
                    step.expected.every((expected, i) =>
                        typeof expected === 'string'
                            ? actual[i] === expected
                            : expected.test(actual[i])
                    );
                return matches
                    ? []
                    : [
                          `expected:\n  ${step.expected.join('\n  ')}\ngot:\n  ${actual.join('\n  ')}`
                      ];
            });
            if (index === 0) {
                // let the file watcher finish its initial scan
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    } finally {
        svelteCheck.stop();
    }
}

async function main() {
    const svelteMajor = Number(
        require(path.join(packages.svelte, 'package.json')).version.split('.')[0]
    );
    if (svelteMajor < 5) {
        console.log('svelte-check TypeScript 7 tests: SKIPPED (needs Svelte 5)');
        return;
    }
    if (!fs.existsSync(path.join(packages.contentMapper, 'dist', 'server.js'))) {
        console.log(`  FAIL: ${CONTENT_MAPPER} isn't built, run \`pnpm build\` at the repo root`);
        process.exitCode = 1;
        return;
    }

    console.log('svelte-check TypeScript 7 tests\n');

    test('test-error: same diagnostics as TypeScript 6, except known differences', () =>
        compareWithTypeScript6('test-error'));
    test('test-success: same diagnostics as TypeScript 6, except known differences', () =>
        compareWithTypeScript6('test-success'));

    const testError = path.join(__dirname, 'test-error');
    const ts7TestError = runSvelteCheck(createWorkspace({ fixture: testError }), {
        args: ['--experimental-ts7']
    });

    test('works without `node` on PATH (the content mapper is started with the running Node.js)', () => {
        const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-path-'));
        temporaryDirectories.push(emptyDirectory);
        const result = runSvelteCheck(createWorkspace({ fixture: testError }), {
            args: ['--experimental-ts7'],
            env: { ...process.env, PATH: emptyDirectory }
        });
        const issues = [];
        if (result.failure) {
            issues.push(`failed: ${result.failure}`);
        }
        if (
            JSON.stringify(result.entries.map(key)) !==
            JSON.stringify(ts7TestError.entries.map(key))
        ) {
            issues.push(
                `different results than with node on PATH:\n${result.entries.map(key).join('\n')}`
            );
        }
        return issues;
    });

    test('TypeScript is not loaded (project with a svelte.config, no generated-code diagnostics)', () => {
        const { result, loaded } = runRecordingTypeScriptLoads(
            createWorkspace({
                fixture: testError,
                files: { 'svelte.config.js': 'export default {};\n' }
            })
        );
        if (result.failure || !loaded) {
            return [`run failed: ${result.failure ?? result.stderr}`];
        }
        return loaded.length ? [`TypeScript was loaded: ${loaded.join(', ')}`] : [];
    });
    test('TypeScript is not loaded (no svelte.config, diagnostics in generated code)', () => {
        const { result, loaded } = runRecordingTypeScriptLoads(
            createWorkspace({ tsconfig: simpleTsconfig, files: bindToNonBindableProp })
        );
        if (result.failure || !loaded) {
            return [`run failed: ${result.failure ?? result.stderr}`];
        }
        const issues = loaded.length ? [`TypeScript was loaded: ${loaded.join(', ')}`] : [];
        // the diagnostic that needs svelte2tsx's template AST (relocated from generated code)
        if (!result.entries.some((entry) => /Cannot use 'bind:'/.test(entry.message))) {
            issues.push(`expected the bind: error, got:\n${result.entries.map(key).join('\n')}`);
        }
        return issues;
    });

    /**
     * @param {ReturnType<typeof runSvelteCheck>} result
     * @param {string[]} expected `file code type`, sorted
     */
    const expectEntries = (result, expected) => {
        if (result.failure || result.status === null) {
            return [`run failed: ${result.failure ?? result.stderr}`];
        }
        const actual = result.entries
            .map((entry) => `${entry.file} ${entry.code} ${entry.type}`)
            .sort();
        return JSON.stringify(actual) === JSON.stringify(expected)
            ? []
            : [`expected:\n  ${expected.join('\n  ')}\ngot:\n  ${actual.join('\n  ')}`];
    };

    const appWithError = {
        'App.svelte': '<script lang="ts">\n\tconst n: number = "x";\n</script>\n\n<p>{n}</p>\n'
    };
    const envWithoutOverride = { ...process.env };
    delete envWithoutOverride.SVELTE_CONTENT_MAPPER_TYPESCRIPT;
    for (const alias of [false, true]) {
        test(`the content mapper parses with the TypeScript 7 that checks (${
            alias ? 'TS7 as @typescript/native, TS6 as typescript' : 'TS7 as typescript'
        })`, () => {
            const mapper = recordingContentMapper();
            const result = runSvelteCheck(
                createWorkspace({
                    tsconfig: {
                        ...simpleTsconfig,
                        contentMappers: [
                            { package: 'recording-content-mapper', extensions: ['.svelte'] }
                        ]
                    },
                    contentMappers: false,
                    typescript: alias ? packages.typescript6 : packages.typescript71,
                    links: {
                        'recording-content-mapper': mapper.dir,
                        ...(alias ? { '@typescript/native': packages.typescript71 } : {})
                    },
                    files: appWithError
                }),
                { args: ['--experimental-ts7'], env: envWithoutOverride }
            );
            const issues = expectEntries(result, ['App.svelte 2322 ERROR']);
            const recorded = mapper.recorded();
            if (!recorded?.typescript) {
                issues.push(
                    `SVELTE_CONTENT_MAPPER_TYPESCRIPT not set: ${JSON.stringify(recorded)}`
                );
            } else if (fs.realpathSync(recorded.typescript) !== packages.typescript71) {
                issues.push(`SVELTE_CONTENT_MAPPER_TYPESCRIPT is ${recorded.typescript}`);
            }
            return issues;
        });
    }

    console.log('\nwhat the tsconfig can look like\n');

    test("contentMappers entry without extensions (from the content mapper's package.json)", () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: { ...simpleTsconfig, contentMappers: [{ package: CONTENT_MAPPER }] },
                    contentMappers: false,
                    files: appWithError
                }),
                { args: ['--experimental-ts7'] }
            ),
            ['App.svelte 2322 ERROR']
        ));
    test('contentMappers entry with include', () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: {
                        ...simpleTsconfig,
                        contentMappers: [
                            {
                                package: CONTENT_MAPPER,
                                extensions: ['.svelte'],
                                include: ['src/**/*']
                            }
                        ]
                    },
                    contentMappers: false,
                    files: { 'src/App.svelte': appWithError['App.svelte'] }
                }),
                { args: ['--experimental-ts7'] }
            ),
            ['src/App.svelte 2322 ERROR']
        ));
    test("without a content mapper, TypeScript's own config errors are in the failure", () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: { ...simpleTsconfig, include: ['src/**'] },
                    contentMappers: false,
                    files: { 'src/App.svelte': appWithError['App.svelte'] }
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /No Svelte file is part of the TypeScript program/,
                /error TS5010: File specification cannot end in a recursive directory wildcard/
            ]
        ));
    const viteFixture = path.join(__dirname, 'test-ts7-vite');
    test('Vite-style tsconfig: the referenced projects are checked', () =>
        expectEntries(
            runSvelteCheck(createWorkspace({ fixture: viteFixture, contentMappers: false }), {
                args: ['--experimental-ts7']
            }),
            ['node.config.ts 6133 ERROR', 'src/App.svelte 2322 ERROR', 'src/shared.ts 2322 ERROR']
        ));
    test('Vite-style tsconfig without a content mapper', () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({
                    fixture: viteFixture,
                    contentMappers: false,
                    files: {
                        'tsconfig.app.json': JSON.stringify({
                            ...readJsonc(path.join(viteFixture, 'tsconfig.app.json')),
                            contentMappers: undefined
                        })
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /No Svelte file is part of the TypeScript program of .*tsconfig\.json and the tsconfigs it references \(.*tsconfig\.app\.json, .*tsconfig\.node\.json\), and none of them has a "contentMappers" entry/,
                /add this to the tsconfig that includes your Svelte files/
            ]
        ));
    test('a file in two referenced projects is checked in both, identical diagnostics once', () => {
        const strict = {
            ...simpleTsconfig,
            include: ['src/**/*'],
            contentMappers: [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }]
        };
        const loose = { ...strict, compilerOptions: { ...strict.compilerOptions, strict: false } };
        return expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: {
                        files: [],
                        // the loose one first: it must not hide the strict one's errors
                        references: [
                            { path: './tsconfig.loose.json' },
                            { path: './tsconfig.strict.json' }
                        ]
                    },
                    contentMappers: false,
                    files: {
                        'tsconfig.loose.json': JSON.stringify(loose),
                        'tsconfig.strict.json': JSON.stringify(strict),
                        // 2322 in both projects, 7006 only with strict
                        'src/App.svelte':
                            '<script lang="ts">\n\tconst n: number = "x";\n\tfunction f(x) { return x; }\n</script>\n\n<p>{n}{f(1)}</p>\n',
                        'src/shared.ts':
                            'export function shared(x) { return x; }\nexport const s: string = 1;\n'
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                'src/App.svelte 2322 ERROR',
                'src/App.svelte 7006 ERROR',
                'src/shared.ts 2322 ERROR',
                'src/shared.ts 7006 ERROR'
            ]
        );
    });
    test('a referenced tsconfig that does not exist is a failure', () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: { ...simpleTsconfig, references: [{ path: './missing' }] },
                    files: appWithError
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /TypeScript could not load .*missing[\\/]tsconfig\.json, which .*tsconfig\.json references/
            ]
        ));

    console.log('\nlike tsc\n');

    test('syntax errors stop the semantic check (tsc order)', () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: simpleTsconfig,
                    files: {
                        'broken.ts': 'export const a = ;\n',
                        'Typed.svelte':
                            '<script lang="ts">\n\tlet n: number = "x";\n</script>\n\n<p>{n}</p>\n'
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            ['broken.ts 1109 ERROR']
        ));
    test('node_modules: TypeScript errors of .ts files are reported, of .svelte files not (like TS6)', () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: simpleTsconfig,
                    files: {
                        'App.svelte':
                            '<script lang="ts">\n\timport Comp from "lib/Comp.svelte";\n\timport { value } from "lib/util";\n</script>\n\n<Comp />{value}\n',
                        'node_modules/lib/package.json': '{ "name": "lib", "version": "1.0.0" }\n',
                        'node_modules/lib/Comp.svelte':
                            '<script lang="ts">\n\tlet n: number = "x";\n</script>\n\n<img src="x.png" />{n}\n',
                        'node_modules/lib/util.ts': 'export const value: number = "x";\n'
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            ['node_modules/lib/util.ts 2322 ERROR']
        ));

    // Svelte's types declare `*.svelte` modules, which hides missing ones from TS7
    const missingSvelteImports = {
        'Exists.svelte': '<p>exists</p>\n',
        'App.svelte':
            '<script lang="ts">\n\timport Exists from "./Exists.svelte";\n\timport Missing from "./Missing.svelte";\n\timport Button from "missing-lib/Button.svelte";\n</script>\n\n<Exists /><Missing /><Button />\n',
        'index.ts':
            'import Exists from "./Exists.svelte";\nimport Missing from "./Missing.svelte";\nexport { default as Button } from "missing-lib/Button.svelte";\nexport { Exists, Missing };\n'
    };
    test('imports of .svelte files that do not exist (relative and package), in .svelte and .ts files', () => {
        const result = runSvelteCheck(
            createWorkspace({ tsconfig: simpleTsconfig, files: missingSvelteImports }),
            { args: ['--experimental-ts7'] }
        );
        const issues = expectEntries(result, [
            'App.svelte 2307 ERROR',
            'App.svelte 2307 ERROR',
            'index.ts 2307 ERROR',
            'index.ts 2307 ERROR'
        ]);
        const located = result.entries
            .map((entry) => `${entry.file}:${entry.line} ${entry.message}`)
            .sort();
        const expected = [
            "App.svelte:2 Cannot find module './Missing.svelte' or its corresponding type declarations.",
            "App.svelte:3 Cannot find module 'missing-lib/Button.svelte' or its corresponding type declarations.",
            "index.ts:1 Cannot find module './Missing.svelte' or its corresponding type declarations.",
            "index.ts:2 Cannot find module 'missing-lib/Button.svelte' or its corresponding type declarations."
        ];
        if (JSON.stringify(located) !== JSON.stringify(expected)) {
            issues.push(`expected:\n  ${expected.join('\n  ')}\ngot:\n  ${located.join('\n  ')}`);
        }
        return issues;
    });
    test('@ts-expect-error and @ts-ignore above an import of a .svelte file that does not exist', () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: simpleTsconfig,
                    files: {
                        'App.svelte':
                            '<script lang="ts">\n\t// @ts-expect-error\n\timport Missing from "./Missing.svelte";\n\t// @ts-ignore\n\timport Other from "./Other.svelte";\n</script>\n\n<Missing /><Other />\n',
                        'index.ts':
                            '// @ts-expect-error\nimport Missing from "./Missing.svelte";\nexport { Missing };\n'
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            // neither the missing modules nor an unused @ts-expect-error (2578)
            []
        ));
    test('imports of .svelte files that do not exist, in files with a byte order mark', () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: simpleTsconfig,
                    files: {
                        'App.svelte':
                            '\uFEFF<script lang="ts">\n\timport Missing from "./Missing.svelte";\n</script>\n\n<Missing />\n',
                        'index.ts': '\uFEFFimport Gone from "./Gone.svelte";\nexport { Gone };\n'
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            ['App.svelte 2307 ERROR', 'index.ts 2307 ERROR']
        ));
    test("a project's own declare module '*.svelte' keeps imports of missing .svelte files silent", () =>
        expectEntries(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: simpleTsconfig,
                    files: {
                        ...missingSvelteImports,
                        'ambient.d.ts':
                            "declare module '*.svelte' {\n\tconst component: any;\n\texport default component;\n}\n"
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            []
        ));

    console.log('\nfailure modes\n');

    test('TypeScript 7.0', () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({ fixture: testError, typescript: createFakeTypeScript('7.0.2') }),
                {
                    args: ['--experimental-ts7']
                }
            ),
            [
                /requires TypeScript 7\.1 or higher, found 7\.0\.2/,
                /Install a TypeScript 7\.1 or higher\n/,
                /npm install --save-dev @typescript\/native@npm:typescript@\^7\.1/
            ]
        ));
    test('no TypeScript 7', () =>
        expectFailure(
            runSvelteCheck(createWorkspace({ fixture: testError, typescript: null }), {
                args: ['--experimental-ts7']
            }),
            [/requires TypeScript 7\.1 or higher in the project/]
        ));
    /**
     * A hook that makes svelte-check's own `typescript` (the one its default mode would load) the
     * given package, and fails if the default mode loads it. The default mode resolves `typescript`
     * from svelte-check, not from the workspace.
     *
     * @param {string} typescriptDir
     */
    const typescriptHook = (typescriptDir) => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-hook-'));
        temporaryDirectories.push(directory);
        const hook = path.join(directory, 'hook.cjs');
        fs.writeFileSync(
            hook,
            `const Module = require('module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === 'typescript/package.json') return ${JSON.stringify(path.join(typescriptDir, 'package.json'))};
    if (request === 'typescript') throw new Error('TypeScript was loaded');
    return resolveFilename.call(this, request, ...rest);
};
`
        );
        return ['--require', hook];
    };
    test('TypeScript 7.1 as `typescript`: the TypeScript 7 support without --experimental-ts7', () => {
        const result = runSvelteCheck(createWorkspace({ fixture: testError }), {
            nodeArgs: typescriptHook(packages.typescript71)
        });
        const issues = [];
        if (result.failure || result.status !== 1) {
            issues.push(`run failed (${result.status}): ${result.failure ?? result.stderr}`);
        }
        if (
            JSON.stringify(result.entries.map(key)) !==
            JSON.stringify(ts7TestError.entries.map(key))
        ) {
            issues.push(
                `different results than with --experimental-ts7:\n${result.entries.map(key).join('\n')}`
            );
        }
        if (
            !/svelte-check: experimental TypeScript 7 support, with TypeScript 7\.1\./.test(
                result.stderr
            )
        ) {
            issues.push(`expected the TypeScript 7 note on stderr, got:\n${result.stderr}`);
        }
        return issues;
    });
    test('TypeScript 7.1 as `typescript` with --tsgo is an error', () => {
        const result = runSvelteCheck(createWorkspace({ fixture: testError }), {
            args: ['--tsgo'],
            nodeArgs: typescriptHook(packages.typescript71)
        });
        return result.status !== 0 &&
            /With TypeScript 7\.1\.\S+ as `typescript`, svelte-check uses its experimental TypeScript 7 support, which cannot be used with --tsgo \(--incremental, --tsgo and --tsgo-experimental-api need TypeScript 5 or 6 as `typescript`\)/.test(
                result.stderr
            )
            ? []
            : [`expected an error, got exit ${result.status}:\n${result.stdout}\n${result.stderr}`];
    });
    test('TypeScript 7.1 as `typescript` with --no-tsconfig is an error', () => {
        const result = runSvelteCheck(createWorkspace({ fixture: testError }), {
            args: ['--no-tsconfig'],
            nodeArgs: typescriptHook(packages.typescript71)
        });
        return result.status !== 0 &&
            /svelte-check uses its experimental TypeScript 7 support, which cannot be used with --no-tsconfig/.test(
                result.stderr
            )
            ? []
            : [`expected an error, got exit ${result.status}:\n${result.stdout}\n${result.stderr}`];
    });
    test('TypeScript 7.1 as `typescript` without a tsconfig is an error', () => {
        const workspace = createWorkspace({ tsconfig: {}, files: appWithError });
        fs.rmSync(path.join(workspace, 'tsconfig.json'));
        const result = spawnSync(
            process.execPath,
            [...typescriptHook(packages.typescript71), CLI, '--workspace', workspace],
            { cwd: __dirname, encoding: 'utf-8', timeout: 120_000 }
        );
        return result.status !== 0 &&
            /svelte-check uses its experimental TypeScript 7 support, which requires a tsconfig\/jsconfig file/.test(
                result.stderr
            )
            ? []
            : [`expected an error, got exit ${result.status}:\n${result.stdout}\n${result.stderr}`];
    });
    test('TypeScript 7.0 as `typescript` is an error, in both modes', () =>
        expectFailure(
            runSvelteCheck(createWorkspace({ fixture: testError }), {
                nodeArgs: typescriptHook(createFakeTypeScript('7.0.2'))
            }),
            [
                /found TypeScript 7\.0\.2 as `typescript` .*, which it doesn't support: its default mode needs TypeScript 5 or 6/,
                /its experimental TypeScript 7 support needs TypeScript 7\.1 or higher/,
                /Install a TypeScript 7\.1 or higher\n/,
                /npm install --save-dev typescript@\^6/
            ]
        ));
    test('tsconfig without a content mapper for .svelte', () =>
        expectFailure(
            runSvelteCheck(createWorkspace({ fixture: testError, contentMappers: false }), {
                args: ['--experimental-ts7']
            }),
            [
                /No Svelte file is part of the TypeScript program of .*tsconfig\.json, and it doesn't have a "contentMappers" entry/,
                /"contentMappers": \[\{ "package": "@sveltejs\/ts-content-mapper"/
            ]
        ));
    test('content mapper package not installed', () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({ fixture: testError, links: { [CONTENT_MAPPER]: null } }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /error TS18075: The content mapper package '@sveltejs\/ts-content-mapper' could not be resolved/,
                /npm install --save-dev @sveltejs\/ts-content-mapper/
            ]
        ));
    test('content mapper process cannot be started', () =>
        expectFailure(
            runSvelteCheck(
                createWorkspace({
                    fixture: testError,
                    tsconfig: {
                        ...readJsonc(path.join(testError, 'tsconfig.json')),
                        contentMappers: [
                            { package: 'fake-content-mapper', extensions: ['.svelte'] }
                        ]
                    },
                    contentMappers: false,
                    links: {
                        'fake-content-mapper': fakeContentMapper([
                            'svelte-check-ts7-missing-command'
                        ])
                    }
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /error TS18099: The content mapper 'fake-content-mapper' could not be initialized/,
                /svelte-check-ts7-missing-command/
            ]
        ));
    test('content mapper disabled after failed transforms', () => {
        /** @type {Record<string, string>} */
        const files = {};
        for (let i = 0; i < 6; i++) {
            files[`Component${i}.svelte`] =
                `<script lang="ts">let n: number = ${i};</script>\n<p>{n}</p>\n`;
        }
        return expectFailure(
            runSvelteCheck(
                createWorkspace({
                    tsconfig: {
                        ...simpleTsconfig,
                        contentMappers: [
                            { package: 'fake-content-mapper', extensions: ['.svelte'] }
                        ]
                    },
                    contentMappers: false,
                    links: { 'fake-content-mapper': fakeContentMapper(['node', 'server.js']) },
                    files
                }),
                { args: ['--experimental-ts7'] }
            ),
            [
                /error TS18070: The content mapper 'fake-content-mapper' failed 5 times and will not be used/,
                /error TS18069: The content mapper .fake-content-mapper. failed to transform this file/,
                /please report it/i
            ]
        );
    });
    for (const conflicting of [
        '--incremental',
        '--tsgo',
        '--tsgo-experimental-api',
        '--no-tsconfig'
    ]) {
        test(`${conflicting} conflicts with --experimental-ts7`, () => {
            const result = runSvelteCheck(createWorkspace({ fixture: testError }), {
                args: ['--experimental-ts7', conflicting]
            });
            return result.status !== 0 && /cannot be used with/.test(result.stderr)
                ? []
                : [
                      `expected an error, got exit ${result.status}:\n${result.stdout}\n${result.stderr}`
                  ];
        });
    }

    console.log('\nwatch mode\n');

    await testWatchMode();
    await testWatchModeReferences();
}

main()
    .catch((error) => {
        console.log(error);
        failed++;
    })
    .finally(() => {
        for (const dir of temporaryDirectories) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        if (failed || passed) {
            console.log(`\n${passed} passed, ${failed} failed`);
        }
        if (failed) {
            process.exitCode = 1;
        }
    });
