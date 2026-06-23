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

    function createConfigLoader(
        globSync: any,
        fs: Pick<typeof import('fs'), 'existsSync'>,
        moduleLoader: (module: URL) => Promise<any>,
        processFeatures: (typeof process)['features'] & { typescript?: false | 'transform' },
        loadFromVite?: (root: string) => Promise<any>
    ) {
        return new ConfigLoader(globSync, fs, path, processFeatures, async (dirOrFile) => {
            if (isConfigFilePath(dirOrFile)) {
                if (/[/\\]svelte\.config\./.test(dirOrFile)) {
                    return loadConfigFile(dirOrFile);
                }
                if (loadFromVite) {
                    const config = await loadFromVite(path.dirname(dirOrFile));
                    if (config) {
                        return { config, configFilePath: dirOrFile, configSource: 'vite' };
                    }
                }
                return loadConfigFile(dirOrFile);
            }

            const viteConfigPath = findConfig(dirOrFile, 'vite.config', [
                'js',
                'mjs',
                'ts',
                'cjs',
                'mts',
                'cts'
            ]);
            if (viteConfigPath && loadFromVite) {
                const config = await loadFromVite(dirOrFile);
                if (config) {
                    return { config, configFilePath: viteConfigPath, configSource: 'vite' };
                }
            }

            const svelteConfigPath = findConfig(
                dirOrFile,
                'svelte.config',
                processFeatures && 'typescript' in processFeatures && processFeatures.typescript
                    ? ['js', 'cjs', 'mjs', 'ts', 'mts']
                    : ['js', 'cjs', 'mjs']
            );
            if (!svelteConfigPath) {
                return undefined;
            }

            return loadConfigFile(svelteConfigPath);

            function isConfigFilePath(filePath: string) {
                return /\.(js|cjs|mjs|ts|mts|cts)$/.test(path.basename(filePath));
            }

            async function loadConfigFile(configFilePath: string) {
                try {
                    const config = (await moduleLoader(pathToFileURL(configFilePath)))?.default;
                    if (!config) {
                        throw new Error('Missing exports in the config.');
                    }
                    return { config, configFilePath, configSource: 'svelte' as const };
                } catch (error) {
                    return {
                        error,
                        configFilePath,
                        configSource: 'svelte' as const
                    };
                }
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

    it('uses explicit config only within the scoped root directory', async () => {
        const appRoot = normalizePath('/monorepo/packages/app');
        const libRoot = normalizePath('/monorepo/packages/lib');
        const explicitConfigPath = path.join(appRoot, 'vite.custom.config.js');
        const libConfigPath = path.join(libRoot, 'svelte.config.js');

        const configLoader = createConfigLoader(
            mockFdir(['svelte.config.js']),
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    (p.endsWith(explicitConfigPath) ||
                        p.endsWith(libConfigPath) ||
                        p.endsWith(path.join(libRoot, 'vite.config.js')))
            },
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } }),
            process.features,
            async (root) => {
                if (root === appRoot) {
                    return viteConfig();
                }
                return undefined;
            }
        );

        configLoader.setExplicitConfigScope({
            configPath: explicitConfigPath,
            rootDirectory: appRoot
        });

        await configLoader.loadConfigs(appRoot);
        await configLoader.loadConfigs(libRoot);

        assert.deepStrictEqual(
            configLoader.getConfig(normalizePath('/monorepo/packages/app/comp.svelte')),
            viteConfig()
        );
        await assertFindsConfig(configLoader, '/monorepo/packages/lib/comp.svelte', libConfigPath);
    });
});
