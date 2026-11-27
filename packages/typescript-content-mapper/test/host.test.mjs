// The mapper as TypeScript 7 uses it (the repo's TypeScript 7, svelte2tsx's dev dependency): what
// the manifest in package.json declares only shows here, not when the mapper process is spoken to
// directly
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createProject, writeFile } from './utils.mjs';

const mapperDir = fileURLToPath(new URL('..', import.meta.url));
const fromSvelte2tsx = createRequire(
    createRequire(import.meta.url).resolve('svelte2tsx/package.json')
);
const typescript7 = fs.realpathSync(
    path.dirname(fromSvelte2tsx.resolve('@typescript/native/package.json'))
);
const svelte = fs.realpathSync(path.dirname(fromSvelte2tsx.resolve('svelte/package.json')));

/** A TS7-only project with the mapper (this package) registered, `mapper` is the registration */
function createHostProject(mapper) {
    const dir = createProject(
        {},
        {
            'package.json': JSON.stringify({ type: 'module' }),
            'tsconfig.json': JSON.stringify({
                compilerOptions: {
                    strict: true,
                    noEmit: true,
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    types: []
                },
                include: ['src/**/*'],
                contentMappers: [mapper]
            }),
            // `fooBar`: the namespace `foreign` keeps the attribute's case in the error message
            'src/App.svelte':
                '<script lang="ts">\n    let ok: number = "not a number";\n</script>\n\n<div fooBar={ok}></div>\n'
        }
    );
    const nodeModules = path.join(dir, 'node_modules');
    fs.mkdirSync(path.join(nodeModules, '@sveltejs'), { recursive: true });
    fs.symlinkSync(typescript7, path.join(nodeModules, 'typescript'));
    fs.symlinkSync(svelte, path.join(nodeModules, 'svelte'));
    fs.symlinkSync(mapperDir, path.join(nodeModules, '@sveltejs', 'ts-content-mapper'));
    return dir;
}

describe('with TypeScript 7', () => {
    it("checks Svelte files with a registration without `extensions` (the manifest's default)", () => {
        const dir = createHostProject({ package: '@sveltejs/ts-content-mapper' });
        let output = '';
        try {
            execFileSync(
                process.execPath,
                [
                    path.join(typescript7, 'bin', 'tsc'),
                    '-p',
                    dir,
                    '--runExternalCode',
                    '--pretty',
                    'false'
                ],
                {
                    encoding: 'utf-8',
                    env: { ...process.env, SVELTE_CONTENT_MAPPER_TYPESCRIPT: '' }
                }
            );
        } catch (error) {
            output = error.stdout;
        }
        assert.match(output, /src\/App\.svelte\(2,9\): error TS2322/);
    });

    it('gives custom elements accessors with `customElement` as a function of the file name', () => {
        const dir = createHostProject({
            package: '@sveltejs/ts-content-mapper',
            extensions: ['.svelte']
        });
        writeFile(
            path.join(dir, 'svelte.config.js'),
            "export default { compilerOptions: { customElement: ({ filename }) => filename.endsWith('Child.svelte') } };"
        );
        writeFile(
            path.join(dir, 'src', 'Child.svelte'),
            '<script lang="ts">export let value: string;</script>\n{value}\n'
        );
        writeFile(
            path.join(dir, 'src', 'read.ts'),
            "import Child from './Child.svelte';\nexport const read = (component: InstanceType<typeof Child>) => {\n    const n: number = component.value;\n    return n;\n};\n"
        );
        let output = '';
        try {
            execFileSync(
                process.execPath,
                [
                    path.join(typescript7, 'bin', 'tsc'),
                    '-p',
                    dir,
                    '--runExternalCode',
                    '--pretty',
                    'false'
                ],
                {
                    encoding: 'utf-8'
                }
            );
        } catch (error) {
            output = error.stdout;
        }
        // with the accessor, `value` is a string
        assert.match(
            output,
            /src\/read\.ts\(3,11\): error TS2322: Type 'string' is not assignable to type 'number'/
        );
    });

    it("reports only the parse error when the template doesn't parse, like TS6", async () => {
        const dir = createHostProject({
            package: '@sveltejs/ts-content-mapper',
            extensions: ['.svelte']
        });
        const tsconfig = path.join(dir, 'tsconfig.json');
        const config = JSON.parse(fs.readFileSync(tsconfig, 'utf-8'));
        config.compilerOptions.noUnusedLocals = true;
        fs.writeFileSync(tsconfig, JSON.stringify(config));
        // a type error, and a variable only the template uses (unused without the template); the
        // template doesn't parse (`<svelte:element>` without `this`), the mapper falls back to the script
        const app = path.join(dir, 'src', 'App.svelte');
        writeFile(
            app,
            '<script lang="ts">\n    let ok: number = "not a number";\n    let usedInTemplate = 1;\n</script>\n\n{usedInTemplate}{ok}\n<svelte:element />\n'
        );
        // `tsc` skips semantic diagnostics when a file has syntactic ones (the parse error), the
        // editor and svelte-check (API) don't
        const requireTs = createRequire(path.join(typescript7, 'package.json'));
        const { API } = await import(pathToFileURL(requireTs.resolve('typescript/async')).href);
        const api = new API({ cwd: dir, runExternalCode: true });
        const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
        try {
            const program = snapshot.getConfiguredProject(tsconfig).program;
            const syntactic = await program.getSyntacticDiagnostics([app]);
            const semantic = await program.getSemanticDiagnostics([app]);
            assert.match(JSON.stringify(syntactic), /must have a 'this' attribute/);
            assert.deepEqual(
                semantic.map((d) => d.code),
                []
            );
        } finally {
            await snapshot.dispose().catch(() => {});
            await api.close().catch(() => {});
        }
    });

    it('transforms the files again when the Svelte config changes (dynamicConfig)', async () => {
        const dir = createHostProject({
            package: '@sveltejs/ts-content-mapper',
            extensions: ['.svelte']
        });
        const requireTs = createRequire(path.join(typescript7, 'package.json'));
        const { API } = await import(pathToFileURL(requireTs.resolve('typescript/async')).href);
        const api = new API({ cwd: dir, runExternalCode: true });
        const tsconfig = path.join(dir, 'tsconfig.json');
        const app = path.join(dir, 'src', 'App.svelte');
        const config = path.join(dir, 'svelte.config.js');
        let snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
        const attribute = async () => {
            const diagnostics = await snapshot
                .getConfiguredProject(tsconfig)
                .program.getSemanticDiagnostics([app]);
            return JSON.stringify(diagnostics).match(/'\\"(fooBar|foobar)\\"'/)?.[1];
        };
        const update = async (fileNotifications) => {
            const previous = snapshot;
            snapshot = await previous.update({ fileNotifications, ensurePrograms: true });
            if (snapshot !== previous) await previous.dispose();
        };
        try {
            assert.equal(await attribute(), 'foobar');
            writeFile(config, "export default { compilerOptions: { namespace: 'foreign' } };");
            await update({ created: [config] });
            assert.equal(await attribute(), 'fooBar');
            fs.rmSync(config);
            await update({ deleted: [config] });
            assert.equal(await attribute(), 'foobar');
        } finally {
            await snapshot.dispose().catch(() => {});
            await api.close().catch(() => {});
        }
    });
});
