import { Logger } from '../../logger';
import { tryImportVite } from '../../importPackage';

export const VITE_CONFIG_EXTENSIONS = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'] as const;

const SVELTE_CONFIG_PLUGIN_NAME = 'vite-plugin-svelte:config';

const viteConfigCache = new Map<string, Promise<ViteSvelteOptions | undefined>>();

export interface ViteSvelteOptions {
    compilerOptions?: Record<string, unknown>;
    preprocess?: unknown;
    extensions?: string[];
    onwarn?: unknown;
    kit?: unknown;
}

export function findViteConfigInDirectory(
    fs: Pick<typeof import('fs'), 'existsSync'>,
    pathUtils: Pick<typeof import('path'), 'join'>,
    directory: string
): string | undefined {
    for (const ending of VITE_CONFIG_EXTENSIONS) {
        const configPath = pathUtils.join(directory, `vite.config.${ending}`);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }
}

export function searchViteConfigPathUpwards(
    fs: Pick<typeof import('fs'), 'existsSync'>,
    pathUtils: Pick<typeof import('path'), 'join' | 'dirname'>,
    startPath: string
): string | undefined {
    let currentDir = startPath;
    let nextDir = pathUtils.dirname(startPath);
    while (currentDir !== nextDir) {
        const configPath = findViteConfigInDirectory(fs, pathUtils, currentDir);
        if (configPath) {
            return configPath;
        }
        currentDir = nextDir;
        nextDir = pathUtils.dirname(currentDir);
    }
}

export function isViteConfigPath(configPath: string): boolean {
    return /[/\\]vite\.config\.(js|mjs|ts|cjs|mts|cts)$/.test(configPath);
}

export function clearViteConfigCache(): void {
    viteConfigCache.clear();
}

/**
 * Resolves a Vite config and reads merged Svelte options from vite-plugin-svelte.
 */
export async function loadSvelteConfigFromVite(
    root: string,
    fromPath: string,
    disabled: boolean
): Promise<ViteSvelteOptions | undefined> {
    if (disabled) {
        return undefined;
    }

    const cached = viteConfigCache.get(root);
    if (cached) {
        return cached;
    }

    const loading = (async () => {
        const vite = tryImportVite(fromPath);
        if (!vite) {
            Logger.log('vite is not installed in', root);
            return undefined;
        }

        try {
            const resolved = await vite.resolveConfig({ root, logLevel: 'error' }, 'serve');
            const plugin = resolved.plugins.find(
                (p: { name?: string }) => p.name === SVELTE_CONFIG_PLUGIN_NAME
            );
            const options = (plugin as { api?: { options?: ViteSvelteOptions } } | undefined)?.api
                ?.options;
            if (!options) {
                Logger.log('No vite-plugin-svelte config found in', root);
                return undefined;
            }
            Logger.log('Loaded Svelte config from vite config at', root);
            return options;
        } catch (err) {
            Logger.error('Error while loading vite config at', root);
            Logger.error(err);
            throw err;
        }
    })();

    viteConfigCache.set(root, loading);
    return loading;
}
