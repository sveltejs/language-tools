import { createRequire } from 'module';

let cachedDefaultTsModule: typeof import('typescript') | null = null;

const MESSAGE_TS_NOT_FOUND =
    'Failed to import TypeScript. ' +
    "If you're using using TypeScript 7, please make sure to install the '@typescript/typescript6' package. " +
    "If you're using svelte2tsx as a library, you can also provide the TypeScript module through the options.";

export function importTsSync(): typeof import('typescript') {
    if (cachedDefaultTsModule) {
        return cachedDefaultTsModule;
    }

    if (typeof require !== 'function') {
        // Replace with @rollup/plugin-replace. Otherwise, in test this file will be treated as an ES module.
        const require = createRequire('import.meta.url');
        return loadByRequire(require);
    }
    return loadByRequire(require);
}

export async function importTs(): Promise<typeof import('typescript')> {
    if (cachedDefaultTsModule) {
        return cachedDefaultTsModule;
    }

    if (typeof require === 'function') {
        return loadByRequire(require);
    }

    try {
        return await import('typescript');
    } catch (error) {
        try {
            // @ts-expect-error
            return await import('@typescript/typescript6');
        } catch (error) {
            throw new Error(MESSAGE_TS_NOT_FOUND);
        }
    }
}

function loadByRequire(requireFn: NodeRequire): typeof import('typescript') {
    try {
        return requireFn('typescript');
    } catch (error) {
        try {
            return requireFn('@typescript/typescript6');
        } catch (error) {
            throw new Error(MESSAGE_TS_NOT_FOUND);
        }
    }
}
