// The types shared by `svelte2tsx` (index.d.ts) and `svelte2tsx/tsgo` (tsgo.d.ts).
// No TypeScript types in here: users of `svelte2tsx/tsgo` may only have TypeScript 7 installed,
// whose `typescript` package has no types of the compiler API.

export interface SvelteCompiledToTsx {
    code: string;
    map: {
        version: number;
        file: string;
        sources: string[];
        sourcesContent?: string[];
        names: string[];
        mappings: string;
        x_google_ignoreList?: number[];
    };
    exportedNames: IExportedNames;
    /**
     * @deprecated Use TypeScript's `TypeChecker` to get the type information instead. This only covers literal typings.
     */
    events: ComponentEvents;

    /**
     * TypeScript 7 span map of `code`, if `generateSpanMapping` is set:
     * `[virtualStart, virtualLength, originalStart, originalLength, kind, features?]`
     * (kind: 0 = Verbatim, 1 = Atom, 2 = Alias). UTF-16 positions.
     */
    spanMappings: [number, number, number, number, number, number?][] | undefined;
    /**
     * TypeScript 7 diagnostic directives of `code`, if `generateSpanMapping` is set and there
     * are any: an `Ignore` directive for each region of purely generated code.
     */
    diagnosticDirectives?: {
        unusedExpectDirectiveDiagnostics: { code: number; messageText: string }[];
        /** `[originalStart, originalLength, virtualStart, virtualEnd, policy, unusedExpectDirectiveIndex?]` (policy: 0 = Ignore, 1 = Expect) */
        directives: [number, number, number, number, number, number?][];
    };
}

export interface IExportedNames {
    has(name: string): boolean;
}

/**
 * @deprecated Use TypeScript's `TypeChecker` to get the type information instead. This only covers literal typings.
 */
export interface ComponentEvents {
    getAll(): { name: string; type: string; doc?: string }[];
}

/**
 * The TypeScript API svelte2tsx parses the contents of the script tags with. One of
 * - TypeScript 6's (or 5's) `ts` namespace: `import ts from 'typescript'`. This is the default of `svelte2tsx`.
 * - a TypeScript 7 implementation: `createTsgoFacade()` of `svelte2tsx/tsgo`. This is the default of `svelte2tsx/tsgo`.
 *
 * Internally, it's the subset of TypeScript 6's API that svelte2tsx uses (`src/facade.ts`).
 */
export interface TsFacade {}

export interface Svelte2TsxOptions {
    /**
     * The TypeScript API to parse the scripts with, see `TsFacade`.
     * Defaults to TypeScript 6 (`svelte2tsx`) or TypeScript 7 (`svelte2tsx/tsgo`).
     */
    typescript?: TsFacade;
    /**
     * Path of the file
     */
    filename?: string;
    /**
     * If the given file uses TypeScript inside script.
     * This cannot be inferred from `svelte2tsx` by looking
     * at the attributes of the script tag because the
     * user may have set a default-language through
     * `svelte-preprocess`.
     */
    isTsFile?: boolean;
    /**
     * Whether to try emitting result when there's a syntax error in the template
     */
    emitOnTemplateError?: boolean;
    /**
     * The namespace option from svelte config
     * see https://svelte.dev/docs#svelte_compile for more info
     */
    namespace?: string;
    /**
     * When setting this to 'dts', all ts/js code and the template code will be thrown out.
     * Only the `code` property will be set on the returned element.
     * Use this as an intermediate step to generate type definitions from a component.
     * It is expected to pass the result to TypeScript which should handle emitting the d.ts files.
     * The shims need to be provided by the user ambient-style,
     * for example through `filenames.push(require.resolve('svelte2tsx/svelte-shims.d.ts'))`.
     * If you pass 'ts', it uses the regular Svelte->TS/JS transformation.
     * 
     * @default 'ts'
     */
    mode?: 'ts' | 'dts',
    /**
     * Tells svelte2tsx from which namespace some specific functions to use.
     * 
     * Example: 'svelteHTML' -> svelteHTML.createElement<..>(..)
     * 
     * A namespace needs to implement the following functions:
     * - `createElement(str: string, validAttributes: ..): Element`
     * - `mapElementTag<Key extends keyof YourElements>(str: Key): YourElements[Key]`
     * 
     * @default 'svelteHTML'
     */
    typingsNamespace?: string;
    /**
     * The accessor option from svelte config. 
     * Would be overridden by the same config in the svelte:option element if exist
     * see https://svelte.dev/docs#svelte_compile for more info
     */
    accessors?: boolean
    /**
     * The Svelte parser to use. Defaults to the one bundled with `svelte2tsx`.
     */
    parse?: typeof import('svelte/compiler').parse;
    /**
     * The VERSION from 'svelte/compiler'. Defaults to the one bundled with `svelte2tsx`.
     * Transpiled output may vary between versions.
     */
    version?: string;
    /**
     * If true, emits JSDoc annotations for types in JS files instead of TypeScript syntax.
     * This is useful for svelte-check's incremental mode where the output needs to be
     * valid JS that tsc can process without errors.
     */
    emitJsDoc?: boolean;
    /**
     * Rewrites relative imports that resolve outside the workspace so they stay valid
     * from the generated file location.
     */
    rewriteExternalImports?: InternalHelpers.RewriteExternalImportsConfig;

    /**
     * Prepends <reference path="..."> directives for the given shim paths to the generated file.
     */
    shimPaths?: string[];

    /**
     * Generates source map information using typescript 7's span map format
     * (`spanMappings`), and diagnostic directives (`diagnosticDirectives`).
     * Changes the output slightly. Not applicable to `mode: 'dts'`.
     */
    generateSpanMapping?: boolean;

    /**
     * Set this if TypeScript also emits declaration files from the output (`declaration` or `composite`),
     * like a content mapper does for projects that emit them. Not applicable to `mode: 'dts'`.
     * The output stays the same apart from what the declarations need:
     * - the default export has the component's name (no `__SvelteComponent_` suffix), unless the component
     *   mentions that name somewhere
     * - its type doesn't reference svelte2tsx's shims (the consumers of the declarations don't have them)
     * - interfaces in the instance script that stay inside the render function become type aliases, because
     *   TypeScript can't refer to types that are local to a function in a declaration file. It inlines type aliases.
     *
     * Svelte 5 only, Svelte 4's class components still reference the shims.
     */
    declarationEmit?: boolean;
}

/**
 * ## Internal, do not use! This is subject to change at any time.
 */
export namespace InternalHelpers {
    export interface AddedCode {
        generatedPos: number;
        originalPos: number;
        length: number;
        total: number;
        inserted: string;
    }

    export interface KitFilesSettings {
        serverHooksPath: string;
        clientHooksPath: string;
        universalHooksPath: string;
        paramsPath: string;
    }

    export interface RewriteExternalImportsConfig {
        workspacePath: string;
        generatedPath: string;
    }

    export interface ScriptTagInfo {
        start: number;
        end: number;
        content: {
            start: number;
            end: number;
        };
        attributes: Record<string, string | boolean>;
    }
}
