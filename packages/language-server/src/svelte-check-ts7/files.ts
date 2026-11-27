// Which files of the TypeScript 7 programs svelte-check reports TypeScript diagnostics for: all of
// them, like tsc, `node_modules` included, with the exceptions below. TypeScript itself decides
// what it checks in the rest (`skipLibCheck`, `skipDefaultLibCheck`, `checkJs`,
// `maxNodeModuleJsDepth`).
//
// Svelte compiler and CSS diagnostics of files in `node_modules` are skipped, too, by `PluginHost`.

export function isSvelteFile(fileName: string): boolean {
    return fileName.endsWith('.svelte');
}

/**
 * Not checked, like in the TypeScript 6 path:
 * - svelte2tsx's ambient type files and Svelte's svelte-html.d.ts, which the content mapper adds
 *   to every program with Svelte files. They aren't the user's code (TS6: `isShimFiles`).
 * - Svelte files in `node_modules` (TS6: `PluginHost` skips all diagnostics of documents there).
 *   With TypeScript 7, the components of a library are typed from their `.svelte` sources, which
 *   aren't written for the user's compiler options and can have thousands of errors.
 * - JS files in `node_modules` (TS6: `getDiagnosticsForTsconfig`)
 *
 * TS files in `node_modules` are checked, as in the TypeScript 6 path.
 */
export function shouldCheckFile(fileName: string): boolean {
    const path = fileName.replace(/\\/g, '/');
    return !isSvelteShimFile(path) && !isSkippedInNodeModules(path);
}

function isSvelteShimFile(path: string): boolean {
    return (
        /\/(\.svelte2tsx-language-server-files|svelte2tsx)\/svelte-(shims|jsx|native-jsx)(-v4)?\.d\.ts$/.test(
            path
        ) || /\/node_modules\/svelte\/svelte-html\.d\.ts$/.test(path)
    );
}

function isSkippedInNodeModules(path: string): boolean {
    if (isSvelteFile(path)) {
        // Sapper convention: code inside node_modules below src
        return path.includes('/node_modules/') && !path.includes('/src/node_modules/');
    }
    return /\/node_modules\/.+\.(c|m)?js$/.test(path);
}
