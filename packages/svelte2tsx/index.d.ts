type SvelteCompiledToTsx = {
    code: string,
    map: import("magic-string").SourceMap
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
    }
): SvelteCompiledToTsx
