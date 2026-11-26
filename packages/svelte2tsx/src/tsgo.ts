// The `svelte2tsx/tsgo` entry point: svelte2tsx with TypeScript 7 (>= 7.1).
// It must not load the `typescript` package of TypeScript 6 (see `index.ts` for that one).
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { svelte2tsx as svelte2tsxWithFacade, type Svelte2TsxOptions } from './svelte2tsx';
import {
    createTsgoFacade as createTsgoFacadeFromModules,
    type Ts7Modules,
    type TsgoFacade
} from './tsgo-facade';
import { internalHelpers as allInternalHelpers } from './helpers';

export interface CreateTsgoFacadeOptions {
    /**
     * Where to load TypeScript 7 from: a module specifier resolved from svelte2tsx (default: `typescript`),
     * or the absolute path of the directory of a TypeScript 7 package, e.g. the one of a project,
     * or one installed under an alias (`"@typescript/native": "npm:typescript@7"`).
     */
    typescript?: string;
}

/**
 * Creates the TypeScript 7 implementation of the TypeScript facade, for the `typescript` option of `svelte2tsx`.
 * It spawns a `tsc --api` process on the first parse; `dispose()` closes it.
 */
export async function createTsgoFacade(options: CreateTsgoFacadeOptions = {}): Promise<TsgoFacade> {
    return createTsgoFacadeFromModules(await loadTypeScript7(options.typescript));
}

/** Loads `typescript/ast` and `typescript/sync` of TypeScript 7, which are ES modules, with `import()` */
async function loadTypeScript7(from = 'typescript'): Promise<Ts7Modules> {
    const resolveFrom = createRequire(import.meta.url);
    const packageJsonPath = path.isAbsolute(from)
        ? path.join(from, 'package.json')
        : resolveFrom.resolve(`${from}/package.json`);
    const { version } = resolveFrom(packageJsonPath);
    if (Number(version.split('.')[0]) < 7) {
        throw new Error(
            `svelte2tsx/tsgo needs TypeScript 7.1 or newer, but ${from} resolved to TypeScript ${version} (${packageJsonPath})`
        );
    }
    // The package refers to itself by its own name, whatever name it's installed under
    const resolveTs = createRequire(packageJsonPath);
    const [ast, sync] = await Promise.all(
        ['typescript/ast', 'typescript/sync'].map(
            (id) => import(pathToFileURL(resolveTs.resolve(id)).href)
        )
    );
    return { ast, sync };
}

let defaultFacade: Promise<TsgoFacade> | undefined;

/** Created on first use; a failure (e.g. TypeScript 7 isn't installed) is retried on the next call */
function getDefaultFacade(): Promise<TsgoFacade> {
    defaultFacade ??= createTsgoFacade().catch((error) => {
        defaultFacade = undefined;
        throw error;
    });
    return defaultFacade;
}

export async function svelte2tsx(svelte: string, options: Svelte2TsxOptions = {}) {
    return svelte2tsxWithFacade(svelte, {
        ...options,
        typescript: options.typescript ?? (await getDefaultFacade())
    });
}

/**
 * ## Internal, do not use! This is subject to change at any time.
 *
 * The helpers that work without TypeScript 6. Not included:
 * - `upsertKitFile`: needs TypeScript 6's module resolution and `ts.sys`,
 *   and content mappers can't transform `.ts` files anyway
 */
export const internalHelpers = {
    isKitFile: allInternalHelpers.isKitFile,
    isKitRouteFile: allInternalHelpers.isKitRouteFile,
    isHooksFile: allInternalHelpers.isHooksFile,
    isParamsFile: allInternalHelpers.isParamsFile,
    toVirtualPos: allInternalHelpers.toVirtualPos,
    toOriginalPos: allInternalHelpers.toOriginalPos,
    /** Needs a facade as the first argument */
    findExports: allInternalHelpers.findExports,
    get_global_types: allInternalHelpers.get_global_types,
    parseTemplateOnly: allInternalHelpers.parseTemplateOnly,
    extractScriptTags: allInternalHelpers.extractScriptTags,
    renderName: allInternalHelpers.renderName
};
