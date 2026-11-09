/**
 * Which files of the TypeScript 7 program svelte-check reports diagnostics for. Same rules as the
 * TypeScript 6 path (`getDiagnosticsForTsconfig` in `svelte-check.ts`, `PluginHost.canSkipDiagnostics`).
 */

export interface FileSelectionOptions {
    skipLibCheck?: boolean;
    skipDefaultLibCheck?: boolean;
}

export function isSvelteFile(fileName: string): boolean {
    return fileName.endsWith('.svelte');
}

export function shouldCheckFile(fileName: string, options: FileSelectionOptions): boolean {
    const path = fileName.replace(/\\/g, '/');
    if (isSvelteFile(path)) {
        // Files inside node_modules are read-only and would pollute the output.
        // Sapper convention: stuff inside node_modules below src is the user's
        return !path.includes('/node_modules/') || path.includes('/src/node_modules/');
    }
    return !(
        (options.skipLibCheck && isDeclarationFile(path)) ||
        (options.skipDefaultLibCheck && isDefaultLibFile(path)) ||
        isSvelteShimFile(path) ||
        // JS files in node_modules
        /\/node_modules\/.+\.(c|m)?js$/.test(path)
    );
}

function isDeclarationFile(path: string): boolean {
    // .d.ts, .d.mts, .d.cts, and declarations for arbitrary extensions like .d.svelte.ts
    return /\.d\.([cm]?ts|[^/]+\.ts)$/.test(path);
}

function isDefaultLibFile(path: string): boolean {
    // TypeScript 7's libs live in its platform package: @typescript/typescript-<platform>/lib/lib.*.d.ts
    return /\/node_modules\/(typescript|@typescript\/[^/]+)\/lib\/lib(\.[^/]*)?\.d\.ts$/.test(path);
}

/**
 * svelte2tsx's ambient type files and Svelte's svelte-html.d.ts, which the content mapper adds to
 * every program with Svelte files (the TypeScript 6 path skips them via `isShimFiles`)
 */
function isSvelteShimFile(path: string): boolean {
    return (
        /\/(\.svelte2tsx-language-server-files|svelte2tsx)\/svelte-(shims|jsx|native-jsx)(-v4)?\.d\.ts$/.test(
            path
        ) || /\/node_modules\/svelte\/svelte-html\.d\.ts$/.test(path)
    );
}
