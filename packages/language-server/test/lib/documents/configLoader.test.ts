import { ConfigLoader } from '../../../src/lib/documents/configLoader';
import path from 'path';
import { pathToFileURL, URL } from 'url';
import assert from 'assert';

describe('ConfigLoader', () => {
    function configFrom(path: string) {
        return {
            compilerOptions: {
                dev: true,
                generate: false
            },
            preprocess: pathToFileURL(path).toString()
        };
    }

    async function assertFindsConfig(
        configLoader: ConfigLoader,
        filePath: string,
        configPath: string
    ) {
        filePath = path.join(...filePath.split('/'));
        configPath = path.join(...configPath.split('/'));
        assert.deepStrictEqual(configLoader.getConfig(filePath), configFrom(configPath));
        assert.deepStrictEqual(await configLoader.awaitConfig(filePath), configFrom(configPath));
    }

    it('should load all config files below and the one inside/above given directory', async () => {
        const configLoader = new ConfigLoader(
            () => ['svelte.config.js', 'below/svelte.config.js'],
            { existsSync: () => true },
            path,
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } })
        );
        await configLoader.loadConfigs('/some/path');

        assertFindsConfig(configLoader, '/some/path/comp.svelte', '/some/path/svelte.config.js');
        assertFindsConfig(
            configLoader,
            '/some/path/aside/comp.svelte',
            '/some/path/svelte.config.js'
        );
        assertFindsConfig(
            configLoader,
            '/some/path/below/comp.svelte',
            '/some/path/below/svelte.config.js'
        );
        assertFindsConfig(
            configLoader,
            '/some/path/below/further/comp.svelte',
            '/some/path/below/svelte.config.js'
        );
    });

    it('finds first above if none found inside/below directory', async () => {
        const configLoader = new ConfigLoader(
            () => [],
            {
                existsSync: (p) =>
                    typeof p === 'string' && p.endsWith(path.join('some', 'svelte.config.js'))
            },
            path,
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } })
        );
        await configLoader.loadConfigs('/some/path');

        assertFindsConfig(configLoader, '/some/path/comp.svelte', '/some/svelte.config.js');
    });

    it('adds fallback if no config found', async () => {
        const configLoader = new ConfigLoader(
            () => [],
            { existsSync: () => false },
            path,
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } })
        );
        await configLoader.loadConfigs('/some/path');

        assert.deepStrictEqual(
            // Can't do the equal-check directly, instead check if it's the expected object props
            // of svelte-preprocess
            Object.keys(configLoader.getConfig('/some/path/comp.svelte')?.preprocess || {}).sort(),
            ['defaultLanguages', 'markup', 'script', 'style'].sort()
        );
    });

    it('will not load config multiple times if config loading started in parallel', async () => {
        let firstGlobCall = true;
        let nrImportCalls = 0;
        const configLoader = new ConfigLoader(
            () => {
                if (firstGlobCall) {
                    firstGlobCall = false;
                    return ['svelte.config.js'];
                } else {
                    return [];
                }
            },
            {
                existsSync: (p) =>
                    typeof p === 'string' &&
                    p.endsWith(path.join('some', 'path', 'svelte.config.js'))
            },
            path,
            (module: URL) => {
                nrImportCalls++;
                return new Promise((resolve) => {
                    setTimeout(() => resolve({ default: { preprocess: module.toString() } }), 500);
                });
            }
        );
        await Promise.all([
            configLoader.loadConfigs('/some/path'),
            configLoader.loadConfigs('/some/path/sub'),
            configLoader.awaitConfig('/some/path/file.svelte')
        ]);

        assertFindsConfig(configLoader, '/some/path/comp.svelte', '/some/path/svelte.config.js');
        assertFindsConfig(
            configLoader,
            '/some/path/sub/comp.svelte',
            '/some/path/svelte.config.js'
        );
        assert.deepStrictEqual(nrImportCalls, 1);
    });

    it('can deal with missing config', () => {
        const configLoader = new ConfigLoader(
            () => [],
            { existsSync: () => false },
            path,
            () => Promise.resolve('unimportant')
        );
        assert.deepStrictEqual(configLoader.getConfig('/some/file.svelte'), undefined);
    });

    it('should await config', async () => {
        const configLoader = new ConfigLoader(
            () => [],
            { existsSync: () => true },
            path,
            (module: URL) => Promise.resolve({ default: { preprocess: module.toString() } })
        );
        assert.deepStrictEqual(
            await configLoader.awaitConfig(path.join('some', 'file.svelte')),
            configFrom(path.join('some', 'svelte.config.js'))
        );
    });
});
