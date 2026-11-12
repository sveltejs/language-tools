// Which files of the TypeScript 7 program svelte-check reports TypeScript diagnostics for: like
// tsc, all of them, `node_modules` included. TypeScript itself decides what it checks there
// (`skipLibCheck`, `skipDefaultLibCheck`, `checkJs`, `maxNodeModuleJsDepth`).
//
// Svelte compiler and CSS diagnostics of files in `node_modules` are still skipped, by `PluginHost`.

export function isSvelteFile(fileName: string): boolean {
    return fileName.endsWith('.svelte');
}

/**
 * The only exception: svelte2tsx's ambient type files and Svelte's svelte-html.d.ts, which the
 * content mapper adds to every program with Svelte files. They aren't the user's code (the
 * TypeScript 6 path skips them via `isShimFiles`).
 */
export function shouldCheckFile(fileName: string): boolean {
    return !isSvelteShimFile(fileName.replace(/\\/g, '/'));
}

function isSvelteShimFile(path: string): boolean {
    return (
        /\/(\.svelte2tsx-language-server-files|svelte2tsx)\/svelte-(shims|jsx|native-jsx)(-v4)?\.d\.ts$/.test(
            path
        ) || /\/node_modules\/svelte\/svelte-html\.d\.ts$/.test(path)
    );
}
