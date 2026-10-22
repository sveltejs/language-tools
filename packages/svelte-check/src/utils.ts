import * as fs from 'fs';
import * as path from 'path';
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
 * Recursively finds files in the workspace that match the provided filter.
 * Excludes `node_modules` directories and hidden directories (starting with `.`).
 * Applies user-specified ignore patterns to filter results.
 *
 * @param workspacePath - Root directory to search from
 * @param filePathsToIgnore - Patterns for files/directories to exclude
 * @param filter - Predicate that decides whether a file should be included
 * @param followSymlinks - Also search symlinked directories that lead out of the workspace
 * @returns Array of absolute paths to all discovered matching files
 */
export async function findFiles(
    workspacePath: string,
    filePathsToIgnore: string[],
    filter: (filePath: string) => boolean,
    followSymlinks = false
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

    const isRedundantLink = followSymlinks ? createRedundantLinkCheck(workspacePath) : () => false;
    const crawler = new fdir()
        .filter((filePath) => filter(filePath) && !isIgnored(filePath))
        .exclude((dirName, dirPath) => {
            // Match by directory name rather than full path so that ancestor
            // directories of the workspace (e.g. a `.local/`, `.config/`,
            // worktree directory) do not cause every descendant to be skipped.
            // See https://github.com/sveltejs/language-tools/issues/3034.
            return (
                dirName === 'node_modules' || dirName.startsWith('.') || isRedundantLink(dirPath)
            );
        })
        .withPathSeparator('/')
        .withFullPaths();
    if (followSymlinks) {
        // Like TypeScript, keep the paths through the link
        crawler.withSymlinks({ resolvePaths: false });
    }
    return crawler.crawl(workspacePath).withPromise();
}

/**
 * A link into the workspace, or to a folder that contains it, leads to files that are found anyway
 * or to a loop, and following it would emit the same components twice.
 */
function createRedundantLinkCheck(workspacePath: string): (dirPath: string) => boolean {
    const realWorkspacePath = fs.realpathSync(workspacePath);
    return (dirPath) => {
        try {
            // Without fdir's trailing slash, which would make lstat follow the link
            const linkPath = path.resolve(dirPath);
            if (!fs.lstatSync(linkPath).isSymbolicLink()) {
                return false;
            }
            const target = fs.realpathSync(linkPath);
            return isInside(realWorkspacePath, target) || isInside(target, realWorkspacePath);
        } catch {
            // Removed since its parent was read
            return true;
        }
    };
}

function isInside(directory: string, filePath: string): boolean {
    const relative = path.relative(directory, filePath);
    return !path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..';
}
