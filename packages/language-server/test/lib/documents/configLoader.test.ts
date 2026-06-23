import { ConfigLoader } from '../../../src/lib/documents/configLoader';
import path from 'path';
import { pathToFileURL, URL } from 'url';
import assert from 'assert';
import { spy } from 'sinon';

describe('ConfigLoader', () => {
    function configFrom(path: string, configSource: 'svelte' | 'vite' = 'svelte') {
        return {
            compilerOptions: {
                dev: true,
                generate: false
            },
            preprocess: pathToFileURL(path).toString(),
            configSource
        };
    }

    function viteConfig() {
        return {
            compilerOptions: {
                dev: true,
                generate: false
            },
            preprocess: { name: 'vite-preprocess' },
            configSource: 'vite' as const
        };
    }

    function normalizePath(filePath: string): string {
        return path.join(...filePath.split('/'));
    }

    function mockFdir(results: string[] | (() => string[])): any {
        return class {
            withPathSeparator() {
                return this;
            }
            exclude() {
                return this;
            }
            filter() {
                return this;
            }
            withRelativePaths() {
                return this;
            }
            crawl() {
                return this;
            }
            sync() {
                return typeof results === 'function' ? results() : results;
            }
        };
    }

    /**
     * Like mockFdir, but actually applies the exclude callback so we can
     * verify that node_modules, vendor, and dotfile exclusion works.
     */
    function mockFdirWithExclude(rawFiles: string[]): any {
        let excludeFn: (path: string) => boolean;
        return class {
            withPathSeparator() {
                return this;
            }
            exclude(cb: (isDir: boolean, path: string) => boolean) {
                excludeFn = (p: string) => cb(false, p);
                return this;
            }
            filter() {
                return this;
            }
            withRelativePaths() {
                return this;
            }
            crawl() {
                return this;
            }
            sync() {
                return rawFiles.filter((f) => !excludeFn(f));
            }
        };
    }

    function createConfigLoader(
        globSync: any,
        fs: Pick<typeof import('fs'), 'existsSync'>,
        moduleLoader: (module: URL) => Promise<any>,
        processFeatures: (typeof process)['features'] & { typescript?: false | 'transform' },
        loadFromVite?: (root: string) => Promise<any>
    ) {
        return new ConfigLoader(globSync, fs, path, processFeatures, async (directory) => {
            const viteConfigPath = findConfig(directory, 'vite.config', [
                'js',
                'mjs',
                'ts',
                'cjs',
                'mts',
                'cts'
            ]);
            if (viteConfigPath && loadFromVite) {
                const config = await loadFromVite(directory);
                if (config) {
                    return { config, configFilePath: viteConfigPath, configSource: 'vite' };
                }
            }

            const svelteConfigPath = findConfig(
                directory,
                'svelte.config',
                processFeatures && 'typescript' in processFeatures && processFeatures.typescript
                    ? ['js', 'cjs', 'mjs', 'ts', 'mts']
                    : ['js', 'cjs', 'mjs']
            );
            if (!svelteConfigPath) {
                return undefined;
            }

            try {
                const config = (await moduleLoader(pathToFileURL(svelteConfigPath)))?.default;
                if (!config) {
                    throw new Error('Missing exports in the config.');
                }
                return { config, configFilePath: svelteConfigPath, configSource: 'svelte' };
            } catch (error) {
                return { error, configFilePath: svelteConfigPath, configSource: 'svelte' };
            }

            function findConfig(
                directory: string,
                basename: 'svelte.config' | 'vite.config',
                extensions: string[]
            ) {
                for (const extension of extensions) {
                    const configPath = path.join(directory, `${basename}.${extension}`);
                    if (fs.existsSync(configPath)) {
                        return configPath;
                    }
                }
            }
        });
    }

    async function assertFindsConfig(
        configLoader: ConfigLoader,
        filePath: string,
        configPath: string
    ) {
        filePath = normalizePath(filePath);
        configPath = normalizePath(configPath);
        assert.deepStrictEqual(configLoader.getConfig(filePath), configFrom(configPath));
        assert.deepStrictEqual(await configLoader.awaitConfig(filePath), configFrom(configPath));
    }

    it('should load all config files below and the one inside/above given directory', async () => {
        const configLoader = createConfigLoader(
            mockFdir(['svelte.config.js', 'below/svelte.config.js']),
            { existsSync: () => true },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        await assertFindsConfig(
            configLoader,
            '/some/path/comp.svelte',
            '/some/path/svelte.config.js'
        );
        await assertFindsConfig(
            configLoader,
            '/some/path/aside/comp.svelte',
            '/some/path/svelte.config.js'
        );
        await assertFindsConfig(
            configLoader,
            '/some/path/below/comp.svelte',
            '/some/path/below/svelte.config.js'
        );
        await assertFindsConfig(
            configLoader,
            '/some/path/below/further/comp.svelte',
            '/some/path/below/svelte.config.js'
        );
    });

    it('finds first above if none found inside/below directory', async () => {
        const configLoader = createConfigLoader(
            mockFdir([]),
            {
                existsSync: (p) =>
                    typeof p === 'string' && p.endsWith(path.join('some', 'svelte.config.js'))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        await assertFindsConfig(configLoader, '/some/path/comp.svelte', '/some/svelte.config.js');
    });

    it('adds fallback if no config found', async () => {
        const configLoader = createConfigLoader(
            mockFdir([]),
            { existsSync: () => false },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        assert.deepStrictEqual(
            // Can't do the equal-check directly, instead check if it's the expected object props
            Object.keys(
                configLoader.getConfig(normalizePath('/some/path/comp.svelte'))?.preprocess || {}
            ).sort(),
            ['name', 'script'].sort()
        );
    });

    it('will not load config multiple times if config loading started in parallel', async () => {
        let firstGlobCall = true;
        let nrImportCalls = 0;
        const configLoader = createConfigLoader(
            mockFdir(() => {
                if (firstGlobCall) {
                    firstGlobCall = false;
                    return ['svelte.config.js'];
                } else {
                    return [];
                }
            }),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    p.endsWith(path.join('some', 'path', 'svelte.config.js'))
            },
            (module: URL) => {
                nrImportCalls++;
                return new Promise((resolve) => {
                    setTimeout(() => resolve({ default: { preprocess: module.toString() } }), 500);
                });
            },
            process.features
        );
        await Promise.all([
            configLoader.loadConfigs(normalizePath('/some/path')),
            configLoader.loadConfigs(normalizePath('/some/path/sub')),
            configLoader.awaitConfig(normalizePath('/some/path/file.svelte'))
        ]);

        await assertFindsConfig(
            configLoader,
            '/some/path/comp.svelte',
            '/some/path/svelte.config.js'
        );
        await assertFindsConfig(
            configLoader,
            '/some/path/sub/comp.svelte',
            '/some/path/svelte.config.js'
        );
        assert.deepStrictEqual(nrImportCalls, 1);
    });

    it('can deal with missing config', () => {
        const configLoader = createConfigLoader(
            mockFdir([]),
            { existsSync: () => false },
            () => Promise.resolve('unimportant'),
            process.features
        );
        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/file.svelte')),
            undefined
        );
    });

    it('should await config', async () => {
        const configLoader = createConfigLoader(
            mockFdir([]),
            { existsSync: () => true },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        assert.deepStrictEqual(
            await configLoader.awaitConfig(normalizePath('some/file.svelte')),
            configFrom(normalizePath('some/svelte.config.js'))
        );
    });

    it('should not load config when disabled', async () => {
        const moduleLoader = spy();
        const configLoader = createConfigLoader(
            mockFdir([]),
            { existsSync: () => true },
            moduleLoader,
            process.features
        );
        configLoader.setDisabled(true);
        await configLoader.awaitConfig(normalizePath('some/file.svelte'));
        assert.deepStrictEqual(moduleLoader.notCalled, true);
    });

    it('loads config from vite.config when no svelte.config found', async () => {
        const viteConfigDir = normalizePath('/some/path');
        const viteConfigPath = path.join(viteConfigDir, 'vite.config.js');
        const configLoader = createConfigLoader(
            mockFdir([]),
            {
                existsSync: (p) => typeof p === 'string' && p.endsWith(viteConfigPath)
            },
            () => Promise.resolve({ default: {} }),
            process.features,
            async (root) => {
                assert.equal(root, viteConfigDir);
                return viteConfig();
            }
        );
        await configLoader.loadConfigs(viteConfigDir);

        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/comp.svelte')),
            viteConfig()
        );
    });

    it('prefers vite.config over svelte.config when both exist', async () => {
        const viteConfigPath = normalizePath('/some/path/vite.config.js');
        const loadFromVite = spy(async () => viteConfig());
        const configLoader = createConfigLoader(
            mockFdir(['svelte.config.js']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(normalizePath('/some/path/svelte.config.js')) ||
                        p.endsWith(viteConfigPath))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features,
            loadFromVite
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/comp.svelte')),
            viteConfig()
        );
        assert.deepStrictEqual(loadFromVite.calledOnce, true);
    });

    it('falls back to preprocessors when vite config has no svelte plugin options', async () => {
        const viteConfigPath = normalizePath('/some/path/vite.config.ts');
        const configLoader = createConfigLoader(
            mockFdir([]),
            {
                existsSync: (p) => typeof p === 'string' && p.endsWith(viteConfigPath)
            },
            () => Promise.resolve({ default: {} }),
            process.features,
            async () => undefined
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        assert.deepStrictEqual(
            Object.keys(
                configLoader.getConfig(normalizePath('/some/path/comp.svelte'))?.preprocess || {}
            ).sort(),
            ['name', 'script'].sort()
        );
    });

    it('can scan svelte.config.ts', async () => {
        const configLoader = createConfigLoader(
            mockFdir(['svelte.config.ts']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    p.endsWith(path.join('some', 'path', 'svelte.config.ts'))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            { ...process.features, typescript: 'transform' }
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        await assertFindsConfig(
            configLoader,
            '/some/path/comp.svelte',
            '/some/path/svelte.config.ts'
        );
    });

    it('can skips svelte.config.ts loading', async () => {
        const configLoader = createConfigLoader(
            mockFdir(['svelte.config.ts', 'svelte.config.cjs']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(path.join('some', 'path', 'svelte.config.ts')) ||
                        p.endsWith(path.join('some', 'path', 'svelte.config.cjs')))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            { ...process.features, typescript: false }
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        await assertFindsConfig(
            configLoader,
            '/some/path/comp.svelte',
            '/some/path/svelte.config.cjs'
        );
    });

    it('should exclude vendor directory when configured via setExcludeDirs', async () => {
        const configLoader = createConfigLoader(
            mockFdirWithExclude(['vendor/laravel/svelte.config.js', 'src/svelte.config.js']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(path.join('vendor', 'laravel', 'svelte.config.js')) ||
                        p.endsWith(path.join('src', 'svelte.config.js')))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        configLoader.setExcludeDirs(['vendor']);
        await configLoader.loadConfigs(normalizePath('/some/path'));

        // vendor config should NOT be found
        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/vendor/laravel/comp.svelte')),
            undefined
        );
        // src config SHOULD be found
        await assertFindsConfig(
            configLoader,
            '/some/path/src/comp.svelte',
            '/some/path/src/svelte.config.js'
        );
    });

    it('should exclude node_modules directory from config crawl', async () => {
        const configLoader = createConfigLoader(
            mockFdirWithExclude(['node_modules/some-pkg/svelte.config.js', 'src/svelte.config.js']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(path.join('node_modules', 'some-pkg', 'svelte.config.js')) ||
                        p.endsWith(path.join('src', 'svelte.config.js')))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        // node_modules config should NOT be found
        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/node_modules/some-pkg/comp.svelte')),
            undefined
        );
        // src config SHOULD be found
        await assertFindsConfig(
            configLoader,
            '/some/path/src/comp.svelte',
            '/some/path/src/svelte.config.js'
        );
    });

    it('should exclude dotfiles and dot-directories from config crawl', async () => {
        const configLoader = createConfigLoader(
            mockFdirWithExclude([
                '.hidden/svelte.config.js',
                '.config/svelte.config.js',
                'src/svelte.config.js'
            ]),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(path.join('.hidden', 'svelte.config.js')) ||
                        p.endsWith(path.join('.config', 'svelte.config.js')) ||
                        p.endsWith(path.join('src', 'svelte.config.js')))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features
        );
        await configLoader.loadConfigs(normalizePath('/some/path'));

        // dotfile configs should NOT be found
        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/.hidden/comp.svelte')),
            undefined
        );
        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/some/path/.config/comp.svelte')),
            undefined
        );
        // src config SHOULD be found
        await assertFindsConfig(
            configLoader,
            '/some/path/src/comp.svelte',
            '/some/path/src/svelte.config.js'
        );
    });
});
