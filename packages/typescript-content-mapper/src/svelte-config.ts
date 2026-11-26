import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '@sveltejs/load-config';

/** The `compilerOptions` of the Svelte config that svelte2tsx needs */
export interface SvelteCompilerOptions {
    namespace?: string;
    accessors?: boolean;
    customElement?: boolean | ((options: { filename: string }) => boolean);
}

export interface ProjectSvelteConfig {
    compilerOptions: SvelteCompilerOptions;
    /** The config file the options come from, if any */
    configFilePath?: string;
    /**
     * `configIdentity` for TS (the mapper declares `dynamicConfig`): a hash of the contents of the
     * `watchedFiles` that exist. Any edit of one of them changes it, even one that doesn't change the
     * options; TS then transforms the project's files again.
     */
    identity: string;
    /**
     * `watchedFiles` for TS: the config files `loadConfig` would find, from the tsconfig's directory
     * up to the directory of the config in use (or the root): the one in use, and the ones that would
     * take precedence if they were created. When one of them changes, TS opens the project again.
     */
    watchedFiles: string[];
}

/** The names `@sveltejs/load-config` looks for in each directory, in its order */
const CONFIG_FILE_NAMES = [
    ...['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'].map((ext) => `vite.config.${ext}`),
    ...['js', 'cjs', 'mjs', 'ts', 'mts'].map((ext) => `svelte.config.${ext}`)
];

/**
 * Loads the Svelte config of a project, i.e. the `vite.config` (vite-plugin-svelte or SvelteKit)
 * or `svelte.config` in `dir` or above, as it is on disk now.
 *
 * The config is evaluated in this process (functions in it, `process.cwd()` and `process.chdir()`
 * work as usual), with a version derived from the contents of the config files: an edited config
 * is evaluated again, ES module or CommonJS (see `loadConfig`'s `version`). If loading fails, the
 * default options are used until it loads again.
 *
 * Limits (documented in the README): files a config imports are not watched or evaluated again, and
 * every evaluated version of an ES module config stays in memory (config edits are rare).
 */
export async function loadProjectSvelteConfig(dir: string): Promise<ProjectSvelteConfig> {
    const searchDir = path.resolve(dir);
    const version = hash(readConfigContents(getWatchedFiles(searchDir)));
    const { compilerOptions, configFilePath } = await load(searchDir, version);
    const watchedFiles = getWatchedFiles(searchDir, configFilePath);
    return {
        compilerOptions,
        configFilePath,
        identity: hash(readConfigContents(watchedFiles)),
        watchedFiles
    };
}

async function load(
    dir: string,
    version: string
): Promise<{ compilerOptions: SvelteCompilerOptions; configFilePath?: string }> {
    try {
        const result = await loadConfig(dir, { version });
        if (!result) {
            return { compilerOptions: {} };
        }
        if (!('config' in result)) {
            console.warn(`Error loading the Svelte config ${result.configFilePath}:`, result.error);
            return { compilerOptions: {}, configFilePath: result.configFilePath };
        }
        return {
            compilerOptions: pickCompilerOptions(result.config.compilerOptions ?? {}),
            configFilePath: result.configFilePath
        };
    } catch (error) {
        console.warn(`Error loading the Svelte config for ${dir}:`, error);
        return { compilerOptions: {} };
    }
}

/** The options svelte2tsx uses, if they have the types Svelte allows for them */
function pickCompilerOptions(options: Record<string, unknown>): SvelteCompilerOptions {
    const picked: SvelteCompilerOptions = {};
    if (typeof options.namespace === 'string') {
        picked.namespace = options.namespace;
    }
    if (typeof options.accessors === 'boolean') {
        picked.accessors = options.accessors;
    }
    if (typeof options.customElement === 'boolean' || typeof options.customElement === 'function') {
        picked.customElement = options.customElement as SvelteCompilerOptions['customElement'];
    }
    return picked;
}

function hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** The contents of the files that exist, with their names */
function readConfigContents(files: string[]): string {
    let contents = '';
    for (const file of files) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        contents += `${file}\0${text}\0`;
    }
    return contents;
}

export function getWatchedFiles(dir: string, configFilePath?: string): string[] {
    const lastDir = configFilePath ? path.dirname(configFilePath) : undefined;
    const files: string[] = [];
    let current = path.resolve(dir);
    while (true) {
        files.push(...CONFIG_FILE_NAMES.map((name) => path.join(current, name)));
        const parent = path.dirname(current);
        if (current === lastDir || parent === current) {
            return files;
        }
        current = parent;
    }
}
