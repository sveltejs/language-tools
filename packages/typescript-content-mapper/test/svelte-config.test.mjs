// The Svelte config of a project and what the mapper tells TS about it (`src/svelte-config.ts`)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { getWatchedFiles, loadProjectSvelteConfig } from '../dist/svelte-config.js';
import { createProject, writeFile } from './utils.mjs';

const pkg = JSON.stringify({ type: 'module' });

describe('loadProjectSvelteConfig', () => {
    it('without a Svelte config: no options, and the candidates up to the root are watched', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        const config = await loadProjectSvelteConfig(dir);
        assert.deepEqual(config.compilerOptions, {});
        assert.equal(config.configFilePath, undefined);
        assert.ok(config.watchedFiles.includes(path.join(dir, 'svelte.config.js')));
        assert.ok(config.watchedFiles.includes(path.join(dir, 'vite.config.ts')));
        assert.ok(
            config.watchedFiles.includes(path.join(path.parse(dir).root, 'svelte.config.js'))
        );
    });

    it('reads the config as it is on disk now, also after it changed', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        const configFile = path.join(dir, 'svelte.config.js');
        writeFile(configFile, "export default { compilerOptions: { namespace: 'foreign' } };");
        const first = await loadProjectSvelteConfig(dir);
        assert.equal(first.compilerOptions.namespace, 'foreign');
        assert.equal(first.configFilePath, configFile);

        // Node caches ES modules: the config must be imported again under another URL
        writeFile(configFile, 'export default { compilerOptions: { accessors: true } };');
        fs.utimesSync(configFile, new Date(), new Date(Date.now() + 5000));
        const second = await loadProjectSvelteConfig(dir);
        assert.deepEqual(second.compilerOptions, { accessors: true });
        assert.notEqual(second.identity, first.identity);

        // unchanged: same identity, so TS keeps its transforms
        const third = await loadProjectSvelteConfig(dir);
        assert.equal(third.identity, second.identity);
    });

    it('finds the config in a parent directory, and watches the ones that would take precedence', async () => {
        const dir = createProject({}, { 'package.json': pkg, 'app/tsconfig.json': '{}' });
        writeFile(path.join(dir, 'svelte.config.js'), 'export default { compilerOptions: {} };');
        const config = await loadProjectSvelteConfig(path.join(dir, 'app'));
        assert.equal(config.configFilePath, path.join(dir, 'svelte.config.js'));
        assert.ok(config.watchedFiles.includes(path.join(dir, 'app', 'svelte.config.js')));
        assert.ok(config.watchedFiles.includes(path.join(dir, 'svelte.config.js')));
        assert.ok(!config.watchedFiles.includes(path.join(path.dirname(dir), 'svelte.config.js')));
    });
});

describe('loadProjectSvelteConfig: reloading', () => {
    /** Writes `file` and moves its mtime on, so that a rewrite within the same tick is a change, too */
    let tick = 0;
    function rewrite(file, content) {
        writeFile(file, content);
        const time = new Date(Date.now() + ++tick * 1000);
        fs.utimesSync(file, time, time);
    }

    it('reloads CommonJS configs', async () => {
        const dir = createProject({}, { 'package.json': '{}' });
        const configFile = path.join(dir, 'svelte.config.cjs');
        rewrite(configFile, 'module.exports = { compilerOptions: { accessors: false } };');
        const first = await loadProjectSvelteConfig(dir);
        rewrite(configFile, 'module.exports = { compilerOptions: { accessors: true } };');
        const second = await loadProjectSvelteConfig(dir);
        assert.deepEqual(first.compilerOptions, { accessors: false });
        assert.deepEqual(second.compilerOptions, { accessors: true });
        assert.notEqual(second.identity, first.identity);
    });

    it('recovers from a config that failed to load (default options meanwhile)', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        const configFile = path.join(dir, 'svelte.config.js');
        rewrite(configFile, "throw new Error('not ready');\nexport default {};");
        assert.deepEqual((await loadProjectSvelteConfig(dir)).compilerOptions, {});

        rewrite(configFile, 'export default { compilerOptions: { accessors: true } };');
        assert.deepEqual((await loadProjectSvelteConfig(dir)).compilerOptions, { accessors: true });

        rewrite(configFile, "throw new Error('broken again');\nexport default {};");
        const broken = await loadProjectSvelteConfig(dir);
        assert.deepEqual(broken.compilerOptions, {});

        rewrite(configFile, 'export default { compilerOptions: { accessors: false } };');
        assert.deepEqual((await loadProjectSvelteConfig(dir)).compilerOptions, {
            accessors: false
        });
    });

    it('changes the identity with any edit of a config file, also one the options come out the same of', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        const configFile = path.join(dir, 'svelte.config.js');
        rewrite(
            configFile,
            'const enabled = false;\nexport default { compilerOptions: { accessors: enabled } };'
        );
        const first = await loadProjectSvelteConfig(dir);
        rewrite(
            configFile,
            '// a comment\nconst enabled = false;\nexport default { compilerOptions: { accessors: enabled } };'
        );
        const second = await loadProjectSvelteConfig(dir);
        assert.deepEqual(second.compilerOptions, first.compilerOptions);
        assert.notEqual(second.identity, first.identity);
        // and unchanged files: same identity
        assert.equal((await loadProjectSvelteConfig(dir)).identity, second.identity);
    });

    it('keeps `customElement` as a function (called per file by the server)', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        rewrite(
            path.join(dir, 'svelte.config.js'),
            "export default { compilerOptions: { namespace: 'foreign', customElement: ({ filename }) => filename.endsWith('.ce.svelte') } };"
        );
        const { compilerOptions } = await loadProjectSvelteConfig(dir);
        assert.equal(compilerOptions.namespace, 'foreign');
        assert.equal(typeof compilerOptions.customElement, 'function');
        assert.equal(compilerOptions.customElement({ filename: '/a/B.ce.svelte' }), true);
        assert.equal(compilerOptions.customElement({ filename: '/a/B.svelte' }), false);
    });

    it('evaluates an unchanged config only once (ES module and CommonJS)', async () => {
        for (const [name, pkgJson, exportDefault] of [
            ['svelte.config.js', pkg, 'export default'],
            ['svelte.config.cjs', '{}', 'module.exports =']
        ]) {
            const dir = createProject({}, { 'package.json': pkgJson });
            const counter = path.join(dir, 'evaluations.txt');
            rewrite(
                path.join(dir, name),
                `require_or_import;\n${exportDefault} { compilerOptions: { accessors: true } };`.replace(
                    'require_or_import',
                    name.endsWith('.cjs')
                        ? `require('node:fs').appendFileSync(${JSON.stringify(counter)}, 'x')`
                        : `(await import('node:fs')).appendFileSync(${JSON.stringify(counter)}, 'x')`
                )
            );
            const first = await loadProjectSvelteConfig(dir);
            const second = await loadProjectSvelteConfig(dir);
            assert.deepEqual(second.compilerOptions, { accessors: true }, name);
            assert.equal(second.identity, first.identity, name);
            assert.equal(fs.readFileSync(counter, 'utf-8'), 'x', name);
        }
    });

    it('runs the config in this process: process.cwd() and process.chdir() work', async () => {
        const dir = createProject({}, { 'package.json': pkg });
        const cwd = process.cwd();
        rewrite(
            path.join(dir, 'svelte.config.js'),
            "const before = process.cwd();\nprocess.chdir(import.meta.dirname);\nconst namespace = process.cwd() === import.meta.dirname ? 'foreign' : 'html';\nprocess.chdir(before);\nexport default { compilerOptions: { namespace } };"
        );
        assert.deepEqual((await loadProjectSvelteConfig(dir)).compilerOptions, {
            namespace: 'foreign'
        });
        assert.equal(process.cwd(), cwd);
    });
});

describe('getWatchedFiles', () => {
    it("lists load-config's names, vite.config first", () => {
        const dir = path.resolve('/a/b');
        assert.deepEqual(
            getWatchedFiles(dir, path.join(dir, 'svelte.config.js')),
            [
                'vite.config.js',
                'vite.config.mjs',
                'vite.config.ts',
                'vite.config.cjs',
                'vite.config.mts',
                'vite.config.cts',
                'svelte.config.js',
                'svelte.config.cjs',
                'svelte.config.mjs',
                'svelte.config.ts',
                'svelte.config.mts'
            ].map((name) => path.join(dir, name))
        );
    });
});
