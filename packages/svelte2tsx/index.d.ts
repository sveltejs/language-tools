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
         * Whether or not TS strictMode is enabled
         */
        strictMode?: boolean;
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
    }
): SvelteCompiledToTsx
