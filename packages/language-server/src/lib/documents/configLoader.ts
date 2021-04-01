import { Logger } from '../../logger';
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess/types';
import { importSveltePreprocess } from '../../importPackage';
import glob from 'glob';
import { dirname, join, relative } from 'path';
import { existsSync } from 'fs';
import { pathToFileURL, URL } from 'url';

export type InternalPreprocessorGroup = PreprocessorGroup & {
    /**
     * svelte-preprocess has this since 4.x
     */
    defaultLanguages?: {
        markup?: string;
        script?: string;
        style?: string;
    };
};

export interface SvelteConfig {
    compilerOptions?: CompileOptions;
    preprocess?: InternalPreprocessorGroup | InternalPreprocessorGroup[];
    loadConfigError?: any;
}

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true
};

const NO_GENERATE: CompileOptions = {
    generate: false
};

/**
 * This function encapsulates the import call in a way
 * that TypeScript does not transpile `import()`.
 * https://github.com/microsoft/TypeScript/issues/43329
 */
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
    modulePath: URL
) => Promise<any>;

const configFiles = new Map<string, SvelteConfig>();
const configFilesAsync = new Map<string, Promise<SvelteConfig>>();
const filePathToConfigPath = new Map<string, string>();

/**
 * Tries to load all `svelte.config.js` files below given directory
 * and the first one found inside/above that directory.
 *
 * @param directory Directory where to load the configs from
 */
export async function loadConfigs(directory: string): Promise<void> {
    Logger.log('Trying to load configs for', directory);

    try {
        const pathResults = glob.sync('**/svelte.config.{js,cjs,mjs}', {
            cwd: directory,
            ignore: 'node_modules/**'
        });
        const someConfigIsImmediateFileInDirectory =
            pathResults.length > 0 && pathResults.some((res) => !dirname(res));
        if (!someConfigIsImmediateFileInDirectory) {
            const configPathUpwards = searchConfigPathUpwards(directory);
            if (configPathUpwards) {
                pathResults.push(relative(directory, configPathUpwards));
            }
        }
        if (pathResults.length === 0) {
            addFallbackConfig(directory);
            return;
        }

        const promises = pathResults
            .map((pathResult) => join(directory, pathResult))
            .filter((pathResult) => {
                const config = configFiles.get(pathResult);
                return !config || config.loadConfigError;
            })
            .map(async (pathResult) => {
                await loadAndCacheConfig(pathResult, directory);
            });
        await Promise.all(promises);
    } catch (e) {
        Logger.error(e);
    }
}

function addFallbackConfig(directory: string) {
    const fallback = useFallbackPreprocessor(directory, false);
    const path = join(directory, 'svelte.config.js');
    configFilesAsync.set(path, Promise.resolve(fallback));
    configFiles.set(path, fallback);
}

function searchConfigPathUpwards(path: string) {
    let currentDir = path;
    let nextDir = dirname(path);
    while (currentDir !== nextDir) {
        const tryFindConfigPath = (ending: string) => {
            const path = join(currentDir, `svelte.config.${ending}`);
            return existsSync(path) ? path : undefined;
        };
        const configPath =
            tryFindConfigPath('js') || tryFindConfigPath('cjs') || tryFindConfigPath('mjs');
        if (configPath) {
            return configPath;
        }

        currentDir = nextDir;
        nextDir = dirname(currentDir);
    }
}

async function loadAndCacheConfig(configPath: string, directory: string) {
    const loadingConfig = configFilesAsync.get(configPath);
    if (loadingConfig) {
        await loadingConfig;
    } else {
        const newConfig = loadConfig(configPath, directory);
        configFilesAsync.set(configPath, newConfig);
        configFiles.set(configPath, await newConfig);
    }
}

async function loadConfig(configPath: string, directory: string) {
    try {
        let config = (await dynamicImport(pathToFileURL(configPath)))?.default;
        config = {
            ...config,
            compilerOptions: {
                ...DEFAULT_OPTIONS,
                ...config.compilerOptions,
                ...NO_GENERATE
            }
        };
        Logger.log('Loaded config at ', configPath);
        return config;
    } catch (err) {
        Logger.error('Error while loading config');
        Logger.error(err);
        const config = {
            ...useFallbackPreprocessor(directory, true),
            compilerOptions: {
                ...DEFAULT_OPTIONS,
                ...NO_GENERATE
            },
            loadConfigError: err
        };
        return config;
    }
}

/**
 * Returns config associated to file. If no config is found, the file
 * was called in a context where no config file search was done before,
 * which can happen
 * - if TS intellisense is turned off and the search did not run on tsconfig init
 * - if the file was opened not through the TS service crawl, but through the LSP
 *
 * @param file
 */
export function getConfig(file: string): SvelteConfig | undefined {
    const cached = filePathToConfigPath.get(file);
    if (cached) {
        return configFiles.get(cached);
    }

    let currentDir = file;
    let nextDir = dirname(file);
    while (currentDir !== nextDir) {
        currentDir = nextDir;
        const config =
            tryGetConfig(file, currentDir, 'js') ||
            tryGetConfig(file, currentDir, 'cjs') ||
            tryGetConfig(file, currentDir, 'mjs');
        if (config) {
            return config;
        }
        nextDir = dirname(currentDir);
    }
}

/**
 * Like `getConfig`, but will search for a config above if no config found.
 */
export async function awaitConfig(file: string): Promise<SvelteConfig | undefined> {
    const config = getConfig(file);
    if (config) {
        return config;
    }

    const configPath = searchConfigPathUpwards(file);
    if (configPath) {
        await loadAndCacheConfig(configPath, dirname(file));
    } else {
        addFallbackConfig(dirname(file));
    }
    return getConfig(file);
}

function tryGetConfig(file: string, fromDirectory: string, configFileEnding: string) {
    const path = join(fromDirectory, `svelte.config.${configFileEnding}`);
    const config = configFiles.get(path);
    if (config) {
        filePathToConfigPath.set(file, path);
        return config;
    }
}

function useFallbackPreprocessor(path: string, foundConfig: boolean): SvelteConfig {
    Logger.log(
        (foundConfig
            ? 'Found svelte.config.js but there was an error loading it. '
            : 'No svelte.config.js found. ') +
            'Using https://github.com/sveltejs/svelte-preprocess as fallback'
    );
    const sveltePreprocess = importSveltePreprocess(path);
    return {
        preprocess: sveltePreprocess({
            // 4.x does not have transpileOnly anymore, but if the user has version 3.x
            // in his repo, that one is loaded instead, for which we still need this.
            typescript: <any>{ transpileOnly: true, compilerOptions: { sourceMap: true } }
        })
    };
}
