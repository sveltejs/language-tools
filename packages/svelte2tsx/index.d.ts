import ts from 'typescript';
import type { InternalHelpers, SvelteCompiledToTsx, Svelte2TsxOptions } from './common';

export * from './common';

/**
 * Converts a Svelte component into TypeScript/JavaScript (TSX) for type checking,
 * using TypeScript 6 (or 5) to parse the scripts. See `svelte2tsx/tsgo` for TypeScript 7.
 */
export function svelte2tsx(svelte: string, options?: Svelte2TsxOptions): SvelteCompiledToTsx;

export interface EmitDtsConfig {
    /**
     * Where to output the declaration files
     */
    declarationDir: string;
    /**
     * Path to `svelte-shims.d.ts` of `svelte2tsx`.
     * Example: `require.resolve('svelte2tsx/svelte-shims.d.ts')`
     * 
     * If a path is given that points to `svelte-shims-v4.d.ts`,
     * the `SvelteComponent` import is used instead of
     * `SvelteComponentTyped` which is deprecated in Svelte v4.
     */
    svelteShimsPath: string;
    /**
     * If you want to emit types only for part of your project,
     * then set this to the folder for which the types should be emitted.
     * Most of the time you don't need this. For SvelteKit, this is for example
     * set to `src/lib` by default.
     */
    libRoot?: string;
    /**
     * Name of your tsconfig file, if it's not the standard `tsconfig.json` or `jsconfig.json` 
     */
    tsconfig?: string;
}

// to make typo fix non-breaking, continue to export the old name but mark it as deprecated
/**@deprecated*/
export interface EmitDtsConig extends EmitDtsConfig {}

/**
 * Searches for a jsconfig or tsconfig starting at `root` and emits d.ts files
 * into `declarationDir` using the ambient file from `svelteShimsPath`.
 * Note: Handwritten `d.ts` files are not copied over; TypeScript does not
 * touch these files.
 */
export function emitDts(config: EmitDtsConfig): Promise<void>;


/**
 * ## Internal, do not use! This is subject to change at any time.
 *
 * Implementation notice: If one of the methods use a TypeScript function which is not from the
 * static top level `ts` namespace, it must be passed as a parameter.
 */
export const internalHelpers: {
    get_global_types: (
        tsSystem: ts.System,
        isSvelte3: boolean,
        sveltePath: string,
        typesPath: string,
        hiddenFolderPath?: string,
    ) => string[],
    isKitFile: (
        fileName: string,
        options: InternalHelpers.KitFilesSettings
    ) => boolean;
    isKitRouteFile: (basename: string) => boolean,
    isHooksFile: (
        fileName: string,
        basename: string,
        hooksPath: string
    ) => boolean,
    isParamsFile: (fileName: string, basename: string, paramsPath: string) =>boolean,
    upsertKitFile: (
        _ts: typeof ts,
        fileName: string,
        kitFilesSettings: InternalHelpers.KitFilesSettings,
        getSource: () => ts.SourceFile | undefined,
        surround?: (code: string) => string,
        rewriteExternalImports?: InternalHelpers.RewriteExternalImportsConfig
    ) => { text: string; addedCode: InternalHelpers.AddedCode[] } | undefined,
    toVirtualPos: (pos: number, addedCode: InternalHelpers.AddedCode[]) => number,
    toOriginalPos: (pos: number, addedCode: InternalHelpers.AddedCode[]) => {pos: number; inGenerated: boolean},
    findExports: (_ts: typeof ts, source: ts.SourceFile, isTsFile: boolean) => Map<
        string,
        | {
            type: 'function';
            node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
            hasTypeDefinition: boolean;
        }
        | {
            type: 'var';
            node: ts.VariableDeclaration;
            hasTypeDefinition: boolean;
        }
    >,
    parseTemplateOnly(svelte: string, options: {
        parse: typeof import('svelte/compiler').parse;
        emitOnTemplateError?: boolean;
        svelte5Plus: boolean;
    }): unknown
    extractScriptTags(svelte: string, options?: {
        parse: typeof import('svelte/compiler').parse;
        svelte5Plus: boolean;
    }): {
        module?: InternalHelpers.ScriptTagInfo;
        instance?: InternalHelpers.ScriptTagInfo;
    };
	renderName: string
};
