import { Logger } from '../../logger';
import { cosmiconfigSync } from 'cosmiconfig';
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess';
import { importSveltePreprocess } from '../../importPackage';

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
    dev: true,
};

const NO_GENERATE: CompileOptions = {
    generate: false,
};

const svelteConfigExplorer = cosmiconfigSync('svelte', {
    packageProp: 'svelte-ls',
    cache: true,
});

/**
 * Tries to load `svelte.config.js`
 *
 * @param path File path of the document to load the config for
 */
export function loadConfig(path: string): SvelteConfig {
    Logger.log('Trying to load config for', path);
    try {
        const result = svelteConfigExplorer.search(path);
        const config: SvelteConfig = result?.config ?? useFallbackPreprocessor(path, false);
        if (result) {
            Logger.log('Found config at ', result.filepath);
        }
        return {
            ...config,
            compilerOptions: { ...DEFAULT_OPTIONS, ...config.compilerOptions, ...NO_GENERATE },
        };
    } catch (err) {
        Logger.error('Error while loading config');
        Logger.error(err);
        return {
            ...useFallbackPreprocessor(path, true),
            compilerOptions: {
                ...DEFAULT_OPTIONS,
                ...NO_GENERATE,
            },
            loadConfigError: err,
        };
    }
}

function useFallbackPreprocessor(path: string, foundConfig: boolean): SvelteConfig {
    Logger.log(
        (foundConfig
            ? 'Found svelte.config.js but there was an error loading it. '
            : 'No svelte.config.js found. ') +
            'Using https://github.com/sveltejs/svelte-preprocess as fallback',
    );
    return {
        preprocess: importSveltePreprocess(path)({
            // 4.x does not have transpileOnly anymore, but if the user has version 3.x
            // in his repo, that one is loaded instead, for which we still need this.
            typescript: <any>{ transpileOnly: true },
        }),
    };
}
