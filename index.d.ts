type SvelteCompiledToTsx = {
    code: string,
    map: import("magic-string").SourceMap
}

export default function svelte2tsx(svelte: string): SvelteCompiledToTsx
