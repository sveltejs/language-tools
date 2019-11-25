import { SourceMap } from "magic-string";

type SvelteCompiledToTsx = {
    code: string,
    map: SourceMap
}

export declare function svelte2tsx(svelte: string): SvelteCompiledToTsx
