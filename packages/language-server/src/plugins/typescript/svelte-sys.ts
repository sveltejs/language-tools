import ts from 'typescript';
import { ensureRealSvelteFilePath, isVirtualSvelteFilePath, toRealSvelteFilePath } from './utils';
import { FileMap } from '../../lib/documents/fileCollection';

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(tsSystem: ts.System) {
    const fileExistsCache = new FileMap<boolean>();

    const svelteSys: ts.System & { deleteFromCache: (path: string) => void } = {
        ...tsSystem,
        fileExists(path: string) {
            path = ensureRealSvelteFilePath(path);
            const exists = fileExistsCache.get(path) ?? tsSystem.fileExists(path);
            fileExistsCache.set(path, exists);
            return exists;
        },
        readFile(path: string) {
            // No getSnapshot here, because TS will very rarely call this and only for files that are not in the project
            return tsSystem.readFile(ensureRealSvelteFilePath(path));
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = extensions ? [...extensions, '.svelte'] : undefined;

            return tsSystem.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        },
        deleteFile(path) {
            fileExistsCache.delete(ensureRealSvelteFilePath(path));
            return tsSystem.deleteFile?.(path);
        },
        deleteFromCache(path) {
            fileExistsCache.delete(ensureRealSvelteFilePath(path));
        }
    };

    if (tsSystem.realpath) {
        const realpath = tsSystem.realpath;
        svelteSys.realpath = function (path) {
            if (isVirtualSvelteFilePath(path)) {
                return realpath(toRealSvelteFilePath(path)) + '.ts';
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
