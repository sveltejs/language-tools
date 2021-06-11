export interface SvelteCompiledToTsx {
    code: string;
    map: import("magic-string").SourceMap;
    exportedNames: IExportedNames;
    events: ComponentEvents;
}

export interface IExportedNames {
    has(name: string): boolean;
}

export interface ComponentEvents {
    getAll(): { name: string; type: string; doc?: string }[];
}

export default function svelte2tsx(
    svelte: string,
    options?: {
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
         */
        namespace?: string;
        /**
         * When setting this to 'dts', all tsx/jsx code and the template code will be thrown out,
         * all shims will be inlined and the component export is written differently.
         * Only the `code` property will be set on the returned element.
         * Use this as an intermediate step to generate type definitions from a component.
         * It is expected to pass the result to TypeScript which should handle emitting the d.ts files.
         */
        mode?: 'tsx' | 'dts'
    }
): SvelteCompiledToTsx
