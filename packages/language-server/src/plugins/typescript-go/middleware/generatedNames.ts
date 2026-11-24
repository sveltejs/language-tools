/**
 * Names that only exist in svelte2tsx's output or its shims.
 * (The extension's completion filter keeps a copy of this list, keep them in sync)
 */

/** e.g. `__sveltets_2_ensureArray`, `$$_dlihC0C` (the per-component instance helper) */
export function isGeneratedIdentifier(name: string): boolean {
    return (
        name.startsWith('__sveltets_') ||
        name.startsWith('$$_') ||
        name === '$$render' ||
        name.endsWith('__SvelteComponent_')
    );
}

/**
 * svelte2tsx names the default export of a component `<Name>__SvelteComponent_`.
 * Users know it as `<Name>`.
 */
const componentExportRegex = /\b([A-Za-z_$][\w$]*)__SvelteComponent_\b/g;

export function replaceGeneratedNames(text: string): string {
    return text.includes('__SvelteComponent_') ? text.replace(componentExportRegex, '$1') : text;
}

/** svelte2tsx's ambient type files, added to every program that contains Svelte files */
const shimFileRegex =
    /[\\/]svelte2tsx[\\/](svelte-shims(-v4)?|svelte-jsx(-v4)?|svelte-native-jsx)\.d\.ts$/;

export function isSvelte2tsxShimUri(uri: string): boolean {
    let path = uri;
    try {
        path = decodeURIComponent(uri);
    } catch {
        // keep as is
    }
    return shimFileRegex.test(path);
}
