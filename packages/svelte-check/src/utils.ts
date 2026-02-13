import { fdir } from 'fdir';

/**
 * Creates an array of predicate functions for testing if a path should be ignored.
 * Supports patterns with `**` at the start (matches anywhere) or end (matches prefix).
 * Throws if patterns contain `*` in unsupported positions.
 *
 * @param filePathsToIgnore - Array of ignore patterns (e.g., "node_modules/**", "**\/__tests__")
 * @returns Array of functions that return true if a path matches the corresponding pattern
 * @throws Error if a pattern uses unsupported glob syntax
 */
export function createIgnored(filePathsToIgnore: string[]): Array<(path: string) => boolean> {
    return filePathsToIgnore.map((i) => {
        if (i.endsWith('**')) i = i.slice(0, -2);

        if (i.startsWith('**')) {
            i = i.slice(2);

            if (i.includes('*'))
                throw new Error(
                    'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
                );

            return (path) => path.includes(i);
        }

        if (i.includes('*'))
            throw new Error(
                'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
            );

        return (path) => path.startsWith(i);
    });
}

/**
 * Recursively finds all Svelte files in the workspace.
 * Excludes `node_modules` directories and hidden directories (starting with `.`).
 * Applies user-specified ignore patterns to filter results.
 *
 * @param workspacePath - Root directory to search from
 * @param filePathsToIgnore - Patterns for files/directories to exclude
 * @returns Array of absolute paths to all discovered Svelte files
 */
export async function findSvelteFiles(
    workspacePath: string,
    filePathsToIgnore: string[]
): Promise<string[]> {
    const offset = workspacePath.length + 1;
    const ignored = createIgnored(filePathsToIgnore);
    const isIgnored = (filePath: string) => {
        const relative = filePath.slice(offset);
        for (const i of ignored) {
            if (i(relative)) {
                return true;
            }
        }
        return false;
    };

    return new fdir()
        .filter((filePath) => filePath.endsWith('.svelte') && !isIgnored(filePath))
        .exclude((_, filePath) => {
            return filePath.includes('/node_modules/') || filePath.includes('/.');
        })
        .withPathSeparator('/')
        .withFullPaths()
        .crawl(workspacePath)
        .withPromise();
}
