import ts from 'typescript';
import { ensureRealSvelteFilePath, isVirtualSvelteFilePath, toRealSvelteFilePath } from './utils';
import { FileMap } from '../../lib/documents/fileCollection';

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(tsSystem: ts.System) {
    const fileExistsCache = new FileMap<boolean>();

    function svelteFileExists(path: string) {
        if (isVirtualSvelteFilePath(path)) {
            const sveltePath = toRealSvelteFilePath(path);
            const sveltePathExists =
                fileExistsCache.get(sveltePath) ?? tsSystem.fileExists(sveltePath);
            fileExistsCache.set(sveltePath, sveltePathExists);
            return sveltePathExists;
        } else {
            return false;
        }
    }

    const svelteSys: ts.System & {
        deleteFromCache: (path: string) => void;
        svelteFileExists: (path: string) => boolean;
    } = {
        ...tsSystem,
        svelteFileExists,
        fileExists(path: string) {
            // We need to check both .svelte and .svelte.ts/js because that's how Svelte 5 will likely mark files with runes in them
            const sveltePathExists = svelteFileExists(path);
            const exists =
                sveltePathExists || (fileExistsCache.get(path) ?? tsSystem.fileExists(path));
            fileExistsCache.set(path, exists);
            return exists;
        },
        readFile(path: string) {
            // No getSnapshot here, because TS will very rarely call this and only for files that are not in the project
            return tsSystem.readFile(svelteFileExists(path) ? toRealSvelteFilePath(path) : path);
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = extensions ? [...extensions, '.svelte'] : undefined;

            return tsSystem.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        },
        deleteFile(path) {
            // assumption: never a foo.svelte.ts file next to a foo.svelte file
            fileExistsCache.delete(ensureRealSvelteFilePath(path));
            fileExistsCache.delete(path);
            return tsSystem.deleteFile?.(path);
        },
        deleteFromCache(path) {
            // assumption: never a foo.svelte.ts file next to a foo.svelte file
            fileExistsCache.delete(ensureRealSvelteFilePath(path));
            fileExistsCache.delete(path);
        }
    };

    if (tsSystem.realpath) {
        const realpath = tsSystem.realpath;
        svelteSys.realpath = function (path) {
            if (svelteFileExists(path)) {
                return realpath(toRealSvelteFilePath(path)) + '.ts';
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
