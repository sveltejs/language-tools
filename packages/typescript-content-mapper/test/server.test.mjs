// The mapper process (`dist/server.js`), spoken to like TS does: JSON-RPC over stdio
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, describe, it, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createMessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { createProject, writeFile } from './utils.mjs';

const server = fileURLToPath(new URL('../dist/server.js', import.meta.url));
// The repo's TypeScript 7 and Svelte 5 (dev dependencies of svelte2tsx)
const fromSvelte2tsx = createRequire(
    createRequire(import.meta.url).resolve('svelte2tsx/package.json')
);
const typescript7 = fs.realpathSync(
    path.dirname(fromSvelte2tsx.resolve('@typescript/native/package.json'))
);
const svelte = fs.realpathSync(path.dirname(fromSvelte2tsx.resolve('svelte/package.json')));

/** A project whose only TypeScript is TypeScript 7 (as `typescript`), with Svelte 5 */
function createTs7Project(files) {
    const dir = createProject({}, { 'package.json': JSON.stringify({ type: 'module' }), ...files });
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.symlinkSync(typescript7, path.join(dir, 'node_modules', 'typescript'));
    fs.symlinkSync(svelte, path.join(dir, 'node_modules', 'svelte'));
    return dir;
}

// TypeScript 6, as svelte2tsx's dev dependency
const typescript6 = fs.realpathSync(
    path.dirname(fromSvelte2tsx.resolve('typescript/package.json'))
);

/**
 * A module hook for the mapper process: logs every file it loads from a package named
 * `typescript`, with the version of that package, to `$TS_LOAD_LOG` (one JSON line per file)
 */
const loadHook = path.join(createProject({}), 'ts-load-hook.mjs');
writeFile(
    loadHook,
    `import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
const versions = new Map();
function typescriptVersion(file) {
    for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
        if (versions.has(dir)) return versions.get(dir);
        const pj = path.join(dir, 'package.json');
        if (fs.existsSync(pj)) {
            const { name, version } = JSON.parse(fs.readFileSync(pj, 'utf8'));
            if (name) {
                versions.set(dir, name === 'typescript' ? version : null);
                return versions.get(dir);
            }
        }
    }
    return null;
}
registerHooks({
    load(url, context, nextLoad) {
        if (url.startsWith('file:')) {
            const version = typescriptVersion(fileURLToPath(url));
            if (version) fs.appendFileSync(process.env.TS_LOAD_LOG, JSON.stringify({ version, url }) + '\\n');
        }
        return nextLoad(url, context);
    }
});
`
);

function startMapper(env = {}) {
    const loadLog = path.join(createProject({}), 'ts-load.log');
    fs.writeFileSync(loadLog, '');
    const childEnv = { ...process.env, TS_LOAD_LOG: loadLog };
    delete childEnv.SVELTE_CONTENT_MAPPER_TYPESCRIPT;
    Object.assign(childEnv, env);
    const child = spawn(process.execPath, ['--import', loadHook, server], {
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (data) => (stderr += data));
    const stdoutChunks = [];
    child.stdout.on('data', (data) => stdoutChunks.push(data));
    const connection = createMessageConnection(
        new StreamMessageReader(child.stdout),
        new StreamMessageWriter(child.stdin)
    );
    connection.listen();
    return {
        request: (method, params) => connection.sendRequest(method, params),
        get stderr() {
            return stderr;
        },
        /** Everything the process wrote to stdout (the protocol channel) */
        get rawStdout() {
            return Buffer.concat(stdoutChunks);
        },
        /** The versions of the TypeScript packages the process loaded files from */
        loadedTypeScripts() {
            const lines = fs.readFileSync(loadLog, 'utf-8').trim().split('\n').filter(Boolean);
            return [...new Set(lines.map((line) => JSON.parse(line).version))].sort();
        },
        dispose() {
            connection.dispose();
            child.kill();
        }
    };
}

/** Starts a mapper, opens `dir/tsconfig.json`, transforms `content` as `dir/A.svelte` */
async function transformIn(dir, content, env = {}) {
    const mapper = startMapper(env);
    try {
        await mapper.request('initialize', { protocolVersion: 1, positionEncodings: ['utf-16'] });
        await mapper.request('openProject', {
            configFileName: path.join(dir, 'tsconfig.json'),
            projectHandle: 'p',
            compilerOptions: {}
        });
        const request = { projectHandle: 'p', fileName: path.join(dir, 'A.svelte'), content };
        const results = [
            await mapper.request('transform', request),
            await mapper.request('transform', request)
        ];
        return {
            results,
            stderr: mapper.stderr,
            loadedTypeScripts: mapper.loadedTypeScripts()
        };
    } finally {
        mapper.dispose();
    }
}

/** A project with `typescript` linked to `typescriptDir` (if given) and Svelte 5 */
function createProjectWith(typescriptDir, packages = {}) {
    const dir = createProject(packages, {
        'package.json': JSON.stringify({ type: 'module' }),
        'tsconfig.json': '{}'
    });
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    if (typescriptDir) {
        fs.symlinkSync(typescriptDir, path.join(dir, 'node_modules', 'typescript'));
    }
    fs.symlinkSync(svelte, path.join(dir, 'node_modules', 'svelte'));
    return dir;
}

describe('mapper process', () => {
    let mapper;
    let project;
    let tsconfig;

    before(async () => {
        project = createTs7Project({ 'tsconfig.json': '{}' });
        tsconfig = path.join(project, 'tsconfig.json');
        mapper = startMapper();
        await mapper.request('initialize', { protocolVersion: 1, positionEncodings: ['utf-16'] });
    });
    after(() => mapper.dispose());

    async function open(handle, configFileName = tsconfig) {
        return mapper.request('openProject', {
            configFileName,
            projectHandle: handle,
            compilerOptions: {}
        });
    }
    function transform(handle, fileName, content) {
        return mapper.request('transform', { projectHandle: handle, fileName, content });
    }

    it('declares its Svelte config: configIdentity and watchedFiles (dynamicConfig)', async () => {
        const result = await open('p1');
        assert.equal(typeof result.configIdentity, 'string');
        assert.ok(result.configIdentity.length > 0);
        assert.ok(result.watchedFiles.includes(path.join(project, 'svelte.config.js')));
        assert.ok(result.watchedFiles.includes(path.join(project, 'vite.config.ts')));
    });

    it('gives the inferred project an identity, without watched files', async () => {
        const result = await open('inferred', '');
        assert.ok(result.configIdentity);
        assert.equal(result.watchedFiles, undefined);
    });

    it('reports a changed Svelte config as a new configIdentity', async () => {
        const before = (await open('p2')).configIdentity;
        writeFile(
            path.join(project, 'svelte.config.js'),
            "export default { compilerOptions: { namespace: 'foreign' } };"
        );
        try {
            const changed = (await open('p3')).configIdentity;
            assert.notEqual(changed, before);
        } finally {
            fs.rmSync(path.join(project, 'svelte.config.js'));
        }
        assert.equal((await open('p4')).configIdentity, before);
    });

    it('produces the same output for the same input (shim references keep their order)', async () => {
        await open('p6');
        const file = path.join(project, 'Same.svelte');
        const content = '<script lang="ts">let { a }: { a: string } = $props();</script>{a}';
        const first = await transform('p6', file, content);
        const second = await transform('p6', file, content);
        const third = await transform('p6', file, content);
        assert.ok(first.text.includes('///<reference path='));
        assert.equal(second.text, first.text);
        assert.equal(third.text, first.text);
    });

    it('parses with TypeScript 7 in a project without TypeScript 6', async () => {
        await open('p7');
        // `const` type parameters and `satisfies` parse. That alone doesn't show which TypeScript
        // parsed (TypeScript 6 has them, too), the modules the process loaded do
        const result = await transform(
            'p7',
            path.join(project, 'Ts7.svelte'),
            '<script lang="ts" generics="const T extends readonly string[]">let { items }: { items: T } = $props(); const x = 1 satisfies number;</script>{items}{x}'
        );
        assert.deepEqual(result.diagnostics, []);
        assert.equal(result.extension, '.ts');
        const loaded = mapper.loadedTypeScripts();
        assert.ok(
            loaded.length > 0 && loaded.every((version) => version.startsWith('7.')),
            loaded.join(', ')
        );
    });
});

describe('which TypeScript parses the scripts', () => {
    it('TypeScript 7.1 in the project: only TypeScript 7 is loaded', async () => {
        const { results, stderr, loadedTypeScripts } = await transformIn(
            createProjectWith(typescript7),
            '<script lang="ts">let a: number = 1;</script>'
        );
        assert.deepEqual(results[0].diagnostics, []);
        assert.match(stderr, /Parsing with TypeScript 7\.1/);
        assert.ok(loadedTypeScripts.length > 0);
        assert.ok(
            loadedTypeScripts.every((version) => version.startsWith('7.')),
            loadedTypeScripts.join(', ')
        );
    });

    it('nothing usable (no TypeScript, TypeScript 6 or 7.0): a diagnostic that says what is missing', async () => {
        for (const packages of [{}, { typescript: '6.0.3' }, { typescript: '7.0.2' }]) {
            const dir = createProjectWith(undefined, packages);
            const { results } = await transformIn(dir, '<script lang="ts">let a = 1;</script>');
            assert.equal(results[0].diagnostics.length, 1);
            assert.match(results[0].diagnostics[0].messageText, /needs TypeScript 7\.1 or newer/);
        }
    });

    it('takes SVELTE_CONTENT_MAPPER_TYPESCRIPT, which TS passes on to the mapper process', async () => {
        const { results, loadedTypeScripts } = await transformIn(
            createProjectWith(typescript6),
            '<script lang="ts">let a: number = 1;</script>',
            { SVELTE_CONTENT_MAPPER_TYPESCRIPT: typescript7 }
        );
        assert.deepEqual(results[0].diagnostics, []);
        assert.ok(
            loadedTypeScripts.every((version) => version.startsWith('7.')),
            loadedTypeScripts.join(', ')
        );
    });
});

/** Splits `buffer` into JSON-RPC frames, throws if anything else is in it */
function parseFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (offset < buffer.length) {
        const headerEnd = buffer.indexOf('\r\n\r\n', offset);
        const header = buffer.subarray(offset, headerEnd).toString();
        const match = /^Content-Length: (\d+)$/.exec(header);
        assert.ok(
            headerEnd !== -1 && match,
            `not a frame header at ${offset}: ${JSON.stringify(header.slice(0, 80))}`
        );
        const start = headerEnd + 4;
        frames.push(JSON.parse(buffer.subarray(start, start + Number(match[1])).toString()));
        offset = start + Number(match[1]);
    }
    return frames;
}

describe('Svelte config output', () => {
    let mapper;
    afterEach(() => mapper?.dispose());

    // a corrupted channel shows as a request that's never answered
    it(
        'keeps the protocol channel clean when the config writes to stdout',
        { timeout: 20_000 },
        async () => {
            const project = createTs7Project({
                'tsconfig.json': '{}',
                'svelte.config.js':
                    "console.log('CONFIG_CONSOLE_LOG');\nprocess.stdout.write('CONFIG_STDOUT_WRITE\\n');\nexport default { compilerOptions: { accessors: true } };"
            });
            mapper = startMapper();
            await mapper.request('initialize', {
                protocolVersion: 1,
                positionEncodings: ['utf-16']
            });
            const opened = await mapper.request('openProject', {
                configFileName: path.join(project, 'tsconfig.json'),
                projectHandle: 'p',
                compilerOptions: {}
            });
            assert.ok(opened.configIdentity);
            const result = await mapper.request('transform', {
                projectHandle: 'p',
                fileName: path.join(project, 'A.svelte'),
                content: '<script lang="ts">export let a = 1;</script>'
            });
            assert.deepEqual(result.diagnostics, []);
            const frames = parseFrames(mapper.rawStdout);
            assert.equal(frames.length, 3);
            assert.match(mapper.stderr, /CONFIG_CONSOLE_LOG/);
            assert.match(mapper.stderr, /CONFIG_STDOUT_WRITE/);
        }
    );
});
