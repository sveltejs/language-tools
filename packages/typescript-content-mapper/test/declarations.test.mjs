// @ts-check
/**
 * Declaration emit with the content mapper: plain `tsc` (TypeScript 7.1) emits `.d.svelte.ts` files
 * for the Svelte components of a library, like svelte2tsx's `emitDts` does, but from the same
 * transformation the editor uses.
 *
 * The fixture library (`fixtures/library/src`) is copied to a temporary directory with its own
 * node_modules (TypeScript 7.1 as `typescript`, Svelte, this content mapper) and a tsconfig with the
 * `contentMappers` entry. The emitted declarations are compared with `fixtures/library/expected`,
 * and a consumer (`fixtures/library/consumer`) is type-checked against them without the mapper.
 *
 * Needs the built content mapper and svelte2tsx (`pnpm bootstrap && pnpm build` at the repo root) and Svelte 5.
 * `UPDATE_EXPECTED=1` updates the expected declarations.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(packageDir, 'test', 'fixtures', 'library');
const expectedDir = path.join(fixtureDir, 'expected');
const updateExpected = !!process.env.UPDATE_EXPECTED || !fs.existsSync(expectedDir);

/** @param {string} name */
function packageDirOf(name) {
    return fs.realpathSync(path.dirname(require.resolve(`${name}/package.json`)));
}

/** @param {string} dir */
function readVersion(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')).version;
}

const typescript7 = packageDirOf('@typescript/native');
// the TypeScript 6 the mapper depends on, for consumers that are still on TypeScript 6
const typescript6 = packageDirOf('typescript');
const svelte = packageDirOf('svelte');
const isSvelte5 = Number(readVersion(svelte).split('.')[0]) >= 5;

const libraryTsconfig = {
    compilerOptions: {
        strict: true,
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        verbatimModuleSyntax: true,
        allowJs: true,
        checkJs: true,
        skipLibCheck: true,
        declaration: true,
        emitDeclarationOnly: true,
        declarationMap: true,
        rootDir: 'src',
        outDir: 'dist'
    },
    include: ['src'],
    contentMappers: [{ package: '@sveltejs/ts-content-mapper', extensions: ['.svelte'] }]
};

/** Checks the declarations themselves, too (`skipLibCheck: false`), so they must be self-contained */
const consumerTsconfig = {
    compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        verbatimModuleSyntax: true,
        allowArbitraryExtensions: true,
        skipLibCheck: false,
        lib: ['esnext', 'dom'],
        types: []
    },
    include: ['consumer.ts']
};

/**
 * @param {string} typescript package directory
 * @param {string[]} args
 * @param {string} cwd
 */
function tsc(typescript, args, cwd) {
    const result = spawnSync(process.execPath, [path.join(typescript, 'bin', 'tsc'), ...args], {
        cwd,
        encoding: 'utf-8',
        timeout: 120_000
    });
    return {
        status: result.status,
        output: (result.stdout + result.stderr).trim() || String(result.error ?? '')
    };
}

/** @param {string} dir @returns {string[]} paths relative to dir, `/`-separated, sorted */
function listFiles(dir, base = dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) =>
            entry.isDirectory()
                ? listFiles(path.join(dir, entry.name), base)
                : [path.relative(base, path.join(dir, entry.name)).split(path.sep).join('/')]
        )
        .sort();
}

/** @param {string} file */
function read(file) {
    return fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n');
}

describe('declaration emit with tsc', { skip: !isSvelte5 && 'needs Svelte 5' }, () => {
    /** @type {string} */
    let workspace;
    /** @type {string} */
    let dist;
    /** @type {{ status: number | null, output: string }} */
    let emit;
    /** @type {string[]} */
    let declarations;

    before(() => {
        assert.ok(
            fs.existsSync(path.join(packageDir, 'dist', 'server.js')),
            'the content mapper is not built, run `pnpm bootstrap && pnpm build` at the repo root'
        );
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-content-mapper-dts-'));
        dist = path.join(workspace, 'dist');
        for (const dir of ['src', 'consumer']) {
            fs.cpSync(path.join(fixtureDir, dir), path.join(workspace, dir), { recursive: true });
        }
        const links = {
            typescript: typescript7,
            svelte,
            '@sveltejs/ts-content-mapper': packageDir
        };
        for (const [name, target] of Object.entries(links)) {
            const link = path.join(workspace, 'node_modules', name);
            fs.mkdirSync(path.dirname(link), { recursive: true });
            fs.symlinkSync(target, link, 'junction');
        }
        fs.writeFileSync(
            path.join(workspace, 'tsconfig.json'),
            JSON.stringify(libraryTsconfig, null, 4)
        );
        fs.writeFileSync(
            path.join(workspace, 'consumer', 'tsconfig.json'),
            JSON.stringify(consumerTsconfig, null, 4)
        );

        emit = tsc(typescript7, ['-p', 'tsconfig.json', '--runExternalCode'], workspace);
        declarations = fs.existsSync(dist)
            ? listFiles(dist).filter((file) => !file.endsWith('.map'))
            : [];

        if (updateExpected && emit.status === 0) {
            fs.rmSync(expectedDir, { recursive: true, force: true });
            for (const file of declarations) {
                fs.mkdirSync(path.dirname(path.join(expectedDir, file)), { recursive: true });
                fs.copyFileSync(path.join(dist, file), path.join(expectedDir, file));
            }
        }
    });

    after(() => {
        if (workspace) {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    });

    it('type-checks the library and emits without errors', () => {
        assert.equal(emit.output, '', 'tsc output');
        assert.equal(emit.status, 0, 'tsc exit code');
    });

    it('emits .d.svelte.ts files for the components', () => {
        assert.deepEqual(declarations, [
            'Clash.d.svelte.ts',
            'GenericJs.d.svelte.ts',
            'GenericTs.d.svelte.ts',
            'LegacyJs.d.svelte.ts',
            'LegacyProps.d.svelte.ts',
            'LegacyTs.d.svelte.ts',
            'ModuleExports.d.svelte.ts',
            'RunesJs.d.svelte.ts',
            'RunesTs.d.svelte.ts',
            'index.d.ts',
            'state.svelte.d.ts'
        ]);
    });

    it('emits the expected declarations', () => {
        assert.deepEqual(declarations, listFiles(expectedDir), 'expected files');
        for (const file of declarations) {
            assert.equal(
                read(path.join(dist, file)),
                read(path.join(expectedDir, file)),
                `${file} (run with UPDATE_EXPECTED=1 to update)`
            );
        }
    });

    it("doesn't reference svelte2tsx's shims or copy JSDoc of generated code", () => {
        for (const file of declarations) {
            const text = read(path.join(dist, file));
            // the shims' definitions that the declarations need are declared in them as `$$__sveltets_2_…`
            assert.doesNotMatch(text, /(?<!\$\$)__sveltets_2_/, file);
            assert.doesNotMatch(text, /@typedef/, file);
        }
    });

    it('names the components like their files, unless that clashes with a name in the component', () => {
        for (const file of declarations.filter((file) => file.endsWith('.d.svelte.ts'))) {
            const name = file.slice(0, -'.d.svelte.ts'.length);
            const exported = name === 'Clash' ? `${name}__SvelteComponent_` : name;
            assert.match(
                read(path.join(dist, file)),
                new RegExp(`^export default ${exported};$`, 'm'),
                file
            );
        }
    });

    it('maps the declarations to the components', () => {
        const map = JSON.parse(read(path.join(dist, 'RunesTs.d.svelte.ts.map')));
        assert.equal(map.file, 'RunesTs.d.svelte.ts');
        assert.deepEqual(map.sources, ['../src/RunesTs.svelte']);
    });

    for (const [name, typescript] of [
        [`TypeScript ${readVersion(typescript7)}`, typescript7],
        [`TypeScript ${readVersion(typescript6)}`, typescript6]
    ]) {
        it(`type-checks a consumer of the declarations with ${name}`, () => {
            const result = tsc(
                typescript,
                ['-p', 'tsconfig.json'],
                path.join(workspace, 'consumer')
            );
            assert.equal(result.output, '', 'tsc output');
            assert.equal(result.status, 0, 'tsc exit code');
        });
    }
});
