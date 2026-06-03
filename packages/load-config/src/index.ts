import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const VITE_CONFIG_EXTENSIONS = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'] as const;
const SVELTE_CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs'] as const;
const SVELTE_CONFIG_TS_EXTENSIONS = ['ts', 'mts'] as const;

type ConfigSource = 'svelte' | 'vite';

interface SvelteConfig {
    compilerOptions?: Record<string, unknown>;
    preprocess?: unknown;
    extensions?: string[];
    kit?: unknown;
    vitePlugin?: unknown;
    [key: string]: unknown;
}

interface LoadedConfig {
    config: SvelteConfig;
    configFilePath: string;
    configSource: ConfigSource;
}

interface FailedConfig {
    error: unknown;
    configFilePath: string;
    configSource: ConfigSource;
}

type LoadConfigResult = LoadedConfig | FailedConfig | undefined;

interface ViteModule {
    resolveConfig(
        inlineConfig: { root: string; configFile: string; logLevel?: string },
        command: 'build' | 'serve'
    ): Promise<{
        plugins: Array<{ name?: string; api?: { options?: SvelteConfig } }>;
    }>;
}

const cache = new Map<string, Promise<LoadConfigResult>>();

/**
 * This function encapsulates the import call in a way
 * that TypeScript does not transpile `import()`.
 * https://github.com/microsoft/TypeScript/issues/43329
 */
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
    modulePath: URL | string
) => Promise<any>;

/**
 * Loads the Svelte configuration by searching for `vite.config` and `svelte.config` files.
 *
 * If `traverse` is true, it starts from the provided directory and traverses up the directory tree until it finds a config or reaches the root.
 * Else it only checks the provided directory.
 *
 * `vite.config` with either vite-plugin-svelte or the SvelteKit plugin providing options is preferred over `svelte.config`.
 *
 * The results are cached to optimize subsequent calls.
 */
export function loadConfig(
    dir: string,
    { traverse = true, clearCache = false }: { traverse?: boolean; clearCache?: boolean } = {}
): Promise<LoadConfigResult> {
    if (clearCache) cache.clear();

    const startDir = path.resolve(dir);
    const cached = cache.get(startDir);
    if (cached) {
        return cached;
    }

    const loading = loadConfigUncached(startDir, traverse);
    cache.set(startDir, loading);
    return loading;
}

async function loadConfigUncached(dir: string, traverse: boolean): Promise<LoadConfigResult> {
    let currentDir = dir;
    const dirs = [dir];

    while (true) {
        const result = await loadConfigFromDirectory(currentDir);
        if (result) {
            if (isLoadedConfig(result)) {
                // Cache the loaded config for all traversed directories
                for (const d of dirs) {
                    cache.set(d, Promise.resolve(result));
                }
            } else {
                cache.delete(dir);
            }
            return result;
        }

        if (!traverse) {
            return undefined;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
        dirs.push(currentDir);
    }
}

async function loadConfigFromDirectory(dir: string): Promise<LoadConfigResult> {
    const viteConfigPath = findConfigInDirectory(dir, 'vite.config', VITE_CONFIG_EXTENSIONS);
    let viteError: FailedConfig | undefined;

    if (viteConfigPath) {
        const result = await loadSvelteConfigFromVite(dir, viteConfigPath);
        if (isLoadedConfig(result)) {
            return result;
        }
        if (result?.error) {
            viteError = result;
        }
    }

    const svelteConfigPath = findConfigInDirectory(
        dir,
        'svelte.config',
        getSvelteConfigExtensions()
    );
    if (!svelteConfigPath) {
        return viteError;
    }

    return (await loadSvelteConfig(svelteConfigPath)) ?? viteError;
}

async function loadSvelteConfigFromVite(
    root: string,
    configFilePath: string
): Promise<LoadConfigResult> {
    const vite = await tryImportVite(root);
    if (!vite) {
        return undefined;
    }

    try {
        const resolved = await vite.resolveConfig(
            { root, configFile: configFilePath, logLevel: 'error' },
            'serve'
        );
        const kitPlugin = resolved.plugins.find(
            (plugin) => plugin.name === 'vite-plugin-sveltekit-setup'
        );
        const kitOptions = kitPlugin?.api?.options;
        if (kitOptions) {
            const { preprocess, compilerOptions, extensions, vitePlugin, ...kit } = kitOptions;
            return {
                config: { preprocess, compilerOptions, extensions, vitePlugin, kit },
                configFilePath,
                configSource: 'vite'
            };
        }

        const sveltePlugin = resolved.plugins.find(
            (plugin) => plugin.name === 'vite-plugin-svelte:config'
        );
        const options = sveltePlugin?.api?.options;
        if (options) {
            return {
                config: options,
                configFilePath,
                configSource: 'vite'
            };
        }
    } catch (error) {
        return {
            error,
            configFilePath,
            configSource: 'vite'
        };
    }
}

async function loadSvelteConfig(configFilePath: string): Promise<LoadConfigResult> {
    try {
        const config = (await dynamicImport(pathToFileURL(configFilePath).href))?.default;
        if (!config) {
            throw new Error(
                'Missing exports in the config. Make sure to include "export default config" or "module.exports = config"'
            );
        }

        return {
            config,
            configFilePath,
            configSource: 'svelte'
        };
    } catch (error) {
        return {
            error,
            configFilePath,
            configSource: 'svelte'
        };
    }
}

async function tryImportVite(fromPath: string): Promise<ViteModule | undefined> {
    try {
        const main = require.resolve('vite', { paths: [fromPath] });
        return await dynamicImport(pathToFileURL(main).href);
    } catch {
        return undefined;
    }
}

function findConfigInDirectory(
    dir: string,
    basename: 'svelte.config' | 'vite.config',
    extensions: readonly string[]
): string | undefined {
    for (const extension of extensions) {
        const configPath = path.join(dir, `${basename}.${extension}`);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }
}

function getSvelteConfigExtensions() {
    return process.features && 'typescript' in process.features && process.features.typescript
        ? [...SVELTE_CONFIG_EXTENSIONS, ...SVELTE_CONFIG_TS_EXTENSIONS]
        : SVELTE_CONFIG_EXTENSIONS;
}

function isLoadedConfig(result: LoadConfigResult): result is LoadedConfig {
    return !!result && 'config' in result;
}
