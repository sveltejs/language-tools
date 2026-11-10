// `svelte2tsx/tsgo`: svelte2tsx with TypeScript 7 (>= 7.1).
// Doesn't need TypeScript 6, neither at runtime nor for these types.
import type { InternalHelpers, SvelteCompiledToTsx, Svelte2TsxOptions, TsFacade } from './common';

export * from './common';

/**
 * Converts a Svelte component into TypeScript/JavaScript (TSX) for type checking,
 * using TypeScript 7 to parse the scripts.
 *
 * Unless the `typescript` option is given, it uses a facade created with `createTsgoFacade()`
 * on the first call, i.e. TypeScript 7 as resolved from svelte2tsx (the `typescript` peer dependency).
 */
export function svelte2tsx(svelte: string, options?: Svelte2TsxOptions): SvelteCompiledToTsx;

/**
 * The TypeScript facade implemented with TypeScript 7. It parses through a `tsc --api` child process
 * (TypeScript 7 has no JavaScript parser), which it spawns on the first parse.
 */
export interface TsgoFacade extends TsFacade {
    /**
     * Closes the `tsc --api` process the facade spawned, if any.
     * Using the facade afterwards spawns a new one.
     */
    dispose(): void;
}

export interface CreateTsgoFacadeOptions {
    /**
     * Where to load TypeScript 7 from: a module specifier resolved from svelte2tsx (default: `typescript`),
     * or the absolute path of the directory of a TypeScript 7 package, e.g. the one of a project,
     * or one installed under an alias (`"@typescript/native": "npm:typescript@7"`).
     *
     * TypeScript 7's modules are ES modules, which are loaded with `require(esm)` (Node 20.19+, 22.12+).
     */
    typescript?: string;
}

export function createTsgoFacade(options?: CreateTsgoFacadeOptions): TsgoFacade;

/**
 * ## Internal, do not use! This is subject to change at any time.
 *
 * The helpers of `svelte2tsx` that don't need TypeScript 6.
 */
export const internalHelpers: {
    get_global_types: (
        tsSystem: {
            fileExists(path: string): boolean;
            directoryExists(path: string): boolean;
            resolvePath(path: string): string;
            readFile(path: string, encoding?: string): string | undefined;
            writeFile(path: string, data: string): void;
        },
        isSvelte3: boolean,
        sveltePath: string,
        typesPath: string,
        hiddenFolderPath?: string
    ) => string[];
    isKitFile: (fileName: string, options: InternalHelpers.KitFilesSettings) => boolean;
    isKitRouteFile: (basename: string) => boolean;
    isHooksFile: (fileName: string, basename: string, hooksPath: string) => boolean;
    isParamsFile: (fileName: string, basename: string, paramsPath: string) => boolean;
    toVirtualPos: (pos: number, addedCode: InternalHelpers.AddedCode[]) => number;
    toOriginalPos: (
        pos: number,
        addedCode: InternalHelpers.AddedCode[]
    ) => { pos: number; inGenerated: boolean };
    /** `source` is a source file of TypeScript 7, parsed with the facade's API */
    findExports: (_ts: TsFacade, source: unknown, isTsFile: boolean) => Map<string, unknown>;
    parseTemplateOnly(
        svelte: string,
        options: {
            parse: typeof import('svelte/compiler').parse;
            emitOnTemplateError?: boolean;
            svelte5Plus: boolean;
        }
    ): unknown;
    extractScriptTags(
        svelte: string,
        options?: {
            parse: typeof import('svelte/compiler').parse;
            svelte5Plus: boolean;
        }
    ): {
        module?: InternalHelpers.ScriptTagInfo;
        instance?: InternalHelpers.ScriptTagInfo;
    };
    renderName: string;
};
