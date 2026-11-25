import { watch as watchFiles } from 'chokidar';
import * as path from 'path';
import type { FileChange, SvelteCheckTs7 } from 'svelte-language-server/svelte-check-ts7';
import { SvelteCheckCliOptions } from '../options';
import { writeDiagnostics } from '../output';
import { Writer } from '../writers';

/**
 * The files whose changes can affect the results. Like the TypeScript 6 path, plus `.json`: TS7
 * reloads the project when the tsconfig (or a config it extends) changes, and JSON modules
 * can be part of the program.
 */
const WATCHED_FILE_REGEX = /\.(svelte|ts|js|jsx|tsx|mjs|cjs|mts|cts|json)$/;
const VITE_CONFIG_REGEX = /vite\.config\.(js|ts)\.timestamp-/;

const DEBOUNCE_MS = 1000;

/**
 * `--watch` for the TypeScript 7 path: checks once, then again after files changed. The changes
 * are passed on to TS7, which derives the next program from the previous one (see
 * `SvelteCheckTs7.fileChanged`). Never resolves.
 */
export async function watch(
    opts: SvelteCheckCliOptions,
    writer: Writer,
    svelteCheck: SvelteCheckTs7
): Promise<void> {
    let pending: NodeJS.Timeout | undefined;
    let running = false;
    let rerun = false;
    const watchedDirectories = new Set<string>();

    const watcher = watchFiles([], {
        ignored: (filePath, stats) =>
            filePath.includes('node_modules') ||
            filePath.includes('.git') ||
            !!stats?.isSocket() ||
            (!!stats?.isFile() &&
                (!WATCHED_FILE_REGEX.test(filePath) || VITE_CONFIG_REGEX.test(filePath))),
        ignoreInitial: true
    })
        .on('add', (filePath) => onChange(filePath, 'created'))
        .on('change', (filePath) => onChange(filePath, 'changed'))
        .on('unlink', (filePath) => onChange(filePath, 'deleted'))
        .on('unlinkDir', (filePath) => onChange(filePath, 'deleted'));

    function onChange(filePath: string, change: FileChange) {
        svelteCheck.fileChanged(path.resolve(filePath), change);
        clearTimeout(pending);
        pending = setTimeout(check, DEBOUNCE_MS);
    }

    /** New directories with program files. Watching a directory includes its subdirectories */
    function updateWatchedDirectories() {
        for (const directory of svelteCheck.getWatchDirectories()) {
            if (!isWatched(directory)) {
                // Like the TypeScript 6 path: existing watchers stay, chokidar's `unwatch` would
                // ignore future events instead of closing them in some cases
                watcher.add(directory);
                watchedDirectories.add(directory);
            }
        }
    }

    function isWatched(directory: string) {
        for (const watched of watchedDirectories) {
            if (directory === watched || directory.startsWith(watched + path.sep)) {
                return true;
            }
        }
        return false;
    }

    async function check() {
        if (running) {
            rerun = true;
            return;
        }
        running = true;
        try {
            writeDiagnostics(opts.workspaceUri, writer, await svelteCheck.getDiagnostics());
        } catch (error: any) {
            // also unexpected errors: keep watching, the next change may fix it
            writer.failure(error);
        } finally {
            updateWatchedDirectories();
            running = false;
            if (rerun) {
                rerun = false;
                check();
            }
        }
    }

    // before the first check, so that no change during it is missed
    updateWatchedDirectories();
    await check();
}
