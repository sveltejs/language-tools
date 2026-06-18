import { Logger } from '../../logger';
import { loadConfig as loadConfigFromDirectory } from '@sveltejs/load-config';
// @ts-ignore
import { CompileOptions } from 'svelte/types/compiler/interfaces';
// @ts-ignore
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess';
import { importSveltePreprocess } from '../../importPackage';
import { fdir } from 'fdir';
import _path from 'path';
import _fs from 'fs';
import { URL } from 'url';
import { FileMap } from './fileCollection';
import ts from 'typescript';

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
    isFallbackConfig?: boolean;
    configSource?: 'svelte' | 'vite';
    kit?: any;
}

type LoadConfigFromDirectoryFn = typeof loadConfigFromDirectory;

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true
};

const NO_GENERATE: CompileOptions = {
    generate: false
};

const SVELTE_CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs'] as const;
const SVELTE_CONFIG_TS_EXTENSIONS = ['ts', 'mts'] as const;
const VITE_CONFIG_EXTENSIONS = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'] as const;

const configRegex =
    /\/(svelte\.config\.(js|ts|cjs|mjs|mts)|vite\.config\.(js|mjs|ts|cjs|mts|cts))$/;
const configRegexWithoutTs =
    /\/(svelte\.config\.(js|cjs|mjs)|vite\.config\.(js|mjs|ts|cjs|mts|cts))$/;

/**
 * Loads vite.config.* and svelte.config.{js,ts,cjs,mjs,mts} files. Provides both
 * a synchronous and asynchronous interface to get a config file
 * because snapshots need access to it synchronously.
 * This means that another instance (the ts service host on startup) should make
 * sure that all config files are loaded before snapshots are retrieved.
 * Asynchronousity is needed because we use the dynamic `import()` statement.
 */
export class ConfigLoader {
    private configFiles = new FileMap<SvelteConfig>();
    private configFilesAsync = new FileMap<Promise<SvelteConfig>>();
    private filePathToConfigPath = new FileMap<string>();
    private disabled = false;
    private loadSvelteConfigTs: boolean;

    constructor(
        private globSync: typeof fdir,
        private fs: Pick<typeof _fs, 'existsSync'>,
        private path: Pick<typeof _path, 'dirname' | 'relative' | 'join'>,
        processFeatures: (typeof process)['features'] & {
            typescript?: false | 'transform';
        },
        private loadFromDirectory: LoadConfigFromDirectoryFn
    ) {
        this.loadSvelteConfigTs =
            processFeatures && 'typescript' in processFeatures && !!processFeatures.typescript;
    }

    /**
     * Enable/disable loading of configs (for security reasons for example)
     */
    setDisabled(disabled: boolean): void {
        this.disabled = disabled;
    }

    /**
     * Tries to load all `svelte.config.js` files below given directory
     * and the first one found inside/above that directory.
     *
     * @param directory Directory where to load the configs from
     */
    async loadConfigs(directory: string): Promise<void> {
        const targetRegex = this.loadSvelteConfigTs ? configRegex : configRegexWithoutTs;
        Logger.log('Trying to load configs for', directory);

        try {
            const pathResults = new this.globSync({})
                .withPathSeparator('/')
                .exclude((_, path) => {
                    // no / at the start, path could start with node_modules
                    return (
                        path.includes('node_modules/') ||
                        path.includes('/vendor/') ||
                        path.includes('/.') ||
                        path[0] === '.'
                    );
                })
                .filter((path, isDir) => {
                    return !isDir && targetRegex.test(path);
                })
                .withRelativePaths()
                .crawl(directory)
                .sync();

            const someConfigIsImmediateFileInDirectory =
                pathResults.length > 0 &&
                pathResults.some((res) => {
                    const dirname = this.path.dirname(res);
                    return !dirname || dirname === '.';
                });
            if (!someConfigIsImmediateFileInDirectory) {
                const configPathUpwards = this.searchConfigPathUpwards(directory);
                if (configPathUpwards) {
                    pathResults.push(this.path.relative(directory, configPathUpwards));
                }
            }
            if (pathResults.length === 0) {
                await this.addFallbackConfig(directory);
                return;
            }

            const promises = pathResults
                .map((pathResult) => this.path.join(directory, pathResult))
                .filter((pathResult) => {
                    const config = this.configFiles.get(pathResult);
                    return !config || config.loadConfigError;
                })
                .map(async (pathResult) => {
                    await this.loadAndCacheConfig(pathResult, directory);
                });
            await Promise.all(promises);
        } catch (e) {
            Logger.error(e);
        }
    }

    private async addFallbackConfig(directory: string) {
        const configPath = this.searchConfigPathUpwards(directory);
        if (configPath) {
            const loadedConfigPath = await this.loadAndCacheConfig(configPath, directory);
            const config = loadedConfigPath && this.configFiles.get(loadedConfigPath);
            if (config && !config.loadConfigError && !config.isFallbackConfig) {
                return;
            }
        }

        const fallback = this.useFallbackPreprocessor(
            directory,
            false,
            configPath && isViteConfigPath(configPath) ? 'vite-error' : 'none'
        );
        const path = this.path.join(directory, 'svelte.config.js');
        this.configFilesAsync.set(path, Promise.resolve(fallback));
        this.configFiles.set(path, fallback);
    }

    private searchSvelteConfigPathUpwards(path: string) {
        let currentDir = path;
        let nextDir = this.path.dirname(path);
        while (currentDir !== nextDir) {
            const configPath = findSvelteConfigInDirectory(
                this.fs,
                this.path,
                currentDir,
                this.loadSvelteConfigTs
            );
            if (configPath) {
                return configPath;
            }

            currentDir = nextDir;
            nextDir = this.path.dirname(currentDir);
        }
    }

    private searchConfigPathUpwards(path: string) {
        let currentDir = path;
        let nextDir = this.path.dirname(path);
        while (currentDir !== nextDir) {
            const configPath =
                findViteConfigInDirectory(this.fs, this.path, currentDir) ??
                findSvelteConfigInDirectory(
                    this.fs,
                    this.path,
                    currentDir,
                    this.loadSvelteConfigTs
                );
            if (configPath) {
                return configPath;
            }

            currentDir = nextDir;
            nextDir = this.path.dirname(currentDir);
        }
    }

    private async loadAndCacheConfig(configPath: string, directory: string) {
        const loadingConfig = this.configFilesAsync.get(configPath);
        if (loadingConfig) {
            await loadingConfig;
            return configPath;
        } else {
            const newConfig = this.loadConfig(configPath, directory);
            this.configFilesAsync.set(
                configPath,
                newConfig.then(({ config }) => config)
            );
            const { config, configFilePath } = await newConfig;
            this.configFiles.set(configFilePath, config);
            if (configFilePath !== configPath) {
                this.configFiles.set(configPath, config);
            }
            return configFilePath;
        }
    }

    private async loadConfig(configPath: string, directory: string) {
        const configDirectory = this.path.dirname(configPath);

        if (this.disabled) {
            return {
                config: {
                    ...this.useFallbackPreprocessor(directory, true, getConfigSource(configPath)),
                    configSource: getConfigSource(configPath),
                    compilerOptions: {
                        ...DEFAULT_OPTIONS,
                        ...NO_GENERATE
                    },
                    loadConfigError: new Error('Config loading is disabled')
                },
                configFilePath: configPath
            };
        }

        const result = await this.loadFromDirectory(configDirectory, { traverse: false });

        if (result && 'config' in result) {
            const configSource = result.configSource;
            const config: SvelteConfig = {
                ...(result.config as SvelteConfig),
                configSource,
                compilerOptions: {
                    ...DEFAULT_OPTIONS,
                    ...(result.config.compilerOptions as CompileOptions | undefined),
                    ...NO_GENERATE
                }
            };
            Logger.log('Loaded config at ', result.configFilePath);
            return {
                config,
                configFilePath: result.configFilePath
            };
        }

        const configSource = result?.configSource ?? getConfigSource(configPath);
        const error =
            result?.error ??
            new Error(
                configSource === 'vite'
                    ? 'No Svelte configuration found in vite config. Is @sveltejs/vite-plugin-svelte configured?'
                    : 'No Svelte configuration found'
            );
        const errorConfigPath = result?.configFilePath ?? configPath;
        Logger.error('Error while loading config at ', errorConfigPath);
        Logger.error(error);

        return {
            config: {
                ...this.useFallbackPreprocessor(directory, true, configSource),
                configSource,
                compilerOptions: {
                    ...DEFAULT_OPTIONS,
                    ...NO_GENERATE
                },
                loadConfigError: error
            },
            configFilePath: errorConfigPath
        };
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
    getConfig(file: string): SvelteConfig | undefined {
        const cached = this.filePathToConfigPath.get(file);
        if (cached) {
            return this.configFiles.get(cached);
        }

        let currentDir = file;
        let nextDir = this.path.dirname(file);
        while (currentDir !== nextDir) {
            currentDir = nextDir;
            const config = this.tryGetConfigForDirectory(file, currentDir);
            if (config) {
                return config;
            }
            nextDir = this.path.dirname(currentDir);
        }
    }

    /**
     * Like `getConfig`, but will search for a config above if no config found.
     */
    async awaitConfig(file: string): Promise<SvelteConfig | undefined> {
        const config = this.getConfig(file);
        if (config) {
            return config;
        }

        const fileDirectory = this.path.dirname(file);
        const configPath = this.searchConfigPathUpwards(fileDirectory);
        if (configPath) {
            await this.loadAndCacheConfig(configPath, fileDirectory);
        } else {
            await this.addFallbackConfig(fileDirectory);
        }
        return this.getConfig(file);
    }

    private tryGetConfigForDirectory(file: string, fromDirectory: string) {
        for (const ending of VITE_CONFIG_EXTENSIONS) {
            const configPath = this.path.join(fromDirectory, `vite.config.${ending}`);
            const config = this.configFiles.get(configPath);
            if (config) {
                this.filePathToConfigPath.set(file, configPath);
                return config;
            }
        }
        for (const ending of getSvelteConfigExtensions(this.loadSvelteConfigTs)) {
            const configPath = this.path.join(fromDirectory, `svelte.config.${ending}`);
            const config = this.configFiles.get(configPath);
            if (config) {
                this.filePathToConfigPath.set(file, configPath);
                return config;
            }
        }
    }

    private useFallbackPreprocessor(
        path: string,
        foundConfig: boolean,
        configKind: 'svelte' | 'vite' | 'vite-error' | 'none'
    ): SvelteConfig {
        try {
            const sveltePreprocess = importSveltePreprocess(path);
            Logger.log(
                getFallbackLogMessage(foundConfig, configKind) +
                    'Using https://github.com/sveltejs/svelte-preprocess as fallback'
            );
            return {
                preprocess: sveltePreprocess({
                    // 4.x does not have transpileOnly anymore, but if the user has version 3.x
                    // in his repo, that one is loaded instead, for which we still need this.
                    typescript: {
                        transpileOnly: true,
                        compilerOptions: { sourceMap: true, inlineSourceMap: false }
                    }
                }),
                isFallbackConfig: true
            };
        } catch (e) {
            // User doesn't have svelte-preprocess installed, provide a barebones TS preprocessor
            return {
                preprocess: {
                    // @ts-ignore name property exists in Svelte 4 onwards
                    name: 'svelte-language-tools-ts-fallback-preprocessor',
                    script: ({ content, attributes, filename }) => {
                        if (attributes.lang !== 'ts') return;

                        const { outputText, sourceMapText } = ts.transpileModule(content, {
                            fileName: filename,
                            compilerOptions: {
                                module: ts.ModuleKind.ESNext,
                                target: ts.ScriptTarget.ESNext,
                                sourceMap: true,
                                verbatimModuleSyntax: true
                            }
                        });
                        return { code: outputText, map: sourceMapText };
                    }
                },
                isFallbackConfig: true
            };
        }
    }
}

function getSvelteConfigExtensions(loadSvelteConfigTs: boolean) {
    return loadSvelteConfigTs
        ? [...SVELTE_CONFIG_EXTENSIONS, ...SVELTE_CONFIG_TS_EXTENSIONS]
        : SVELTE_CONFIG_EXTENSIONS;
}

function findSvelteConfigInDirectory(
    fs: Pick<typeof _fs, 'existsSync'>,
    pathUtils: Pick<typeof _path, 'join'>,
    directory: string,
    loadSvelteConfigTs: boolean
) {
    for (const ending of getSvelteConfigExtensions(loadSvelteConfigTs)) {
        const configPath = pathUtils.join(directory, `svelte.config.${ending}`);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }
}

function findViteConfigInDirectory(
    fs: Pick<typeof _fs, 'existsSync'>,
    pathUtils: Pick<typeof _path, 'join'>,
    directory: string
) {
    for (const ending of VITE_CONFIG_EXTENSIONS) {
        const configPath = pathUtils.join(directory, `vite.config.${ending}`);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }
}

function isViteConfigPath(configPath: string): boolean {
    return /[/\\]vite\.config\.(js|mjs|ts|cjs|mts|cts)$/.test(configPath);
}

function getConfigSource(configPath: string): 'svelte' | 'vite' {
    return isViteConfigPath(configPath) ? 'vite' : 'svelte';
}

function getFallbackLogMessage(
    foundConfig: boolean,
    configKind: 'svelte' | 'vite' | 'vite-error' | 'none'
) {
    if (foundConfig && configKind === 'svelte') {
        return 'Found svelte.config.js but there was an error loading it. ';
    }
    if (foundConfig && configKind === 'vite') {
        return 'Found vite.config but there was an error loading it. ';
    }
    if (configKind === 'vite-error') {
        return 'Found vite.config but there was an error loading Svelte options from it. ';
    }
    return 'No svelte.config.js or vite.config found. ';
}

export const configLoader = new ConfigLoader(
    fdir,
    _fs,
    _path,
    process.features,
    loadConfigFromDirectory
);
