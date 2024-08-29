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

            // First check if there's a `.svelte.d.ts` or `.d.svelte.ts` file, which should take precedence
            const dtsPath = sveltePath.slice(0, -7) + '.svelte.d.ts';
            const dtsPathExists = fileExistsCache.get(dtsPath) ?? tsSystem.fileExists(dtsPath);
            fileExistsCache.set(dtsPath, dtsPathExists);
            if (dtsPathExists) return false;

            const svelteDtsPathExists = fileExistsCache.get(path) ?? tsSystem.fileExists(path);
            fileExistsCache.set(path, svelteDtsPathExists);
            if (svelteDtsPathExists) return false;

            const sveltePathExists =
                fileExistsCache.get(sveltePath) ?? tsSystem.fileExists(sveltePath);
            fileExistsCache.set(sveltePath, sveltePathExists);
            return sveltePathExists;
        } else {
            return false;
        }
    }

    function getRealSveltePathIfExists(path: string) {
        return svelteFileExists(path) ? toRealSvelteFilePath(path) : path;
    }

    const svelteSys: ts.System & {
        deleteFromCache: (path: string) => void;
        svelteFileExists: (path: string) => boolean;
        getRealSveltePathIfExists: (path: string) => string;
    } = {
        ...tsSystem,
        svelteFileExists,
        getRealSveltePathIfExists,
        fileExists(path: string) {
            // We need to check if this is a virtual svelte file
            const sveltePathExists = svelteFileExists(path);
            if (sveltePathExists) return true;

            const exists = fileExistsCache.get(path) ?? tsSystem.fileExists(path);
            fileExistsCache.set(path, exists);
            return exists;
        },
        readFile(path: string) {
            // No getSnapshot here, because TS will very rarely call this and only for files that are not in the project
            return tsSystem.readFile(getRealSveltePathIfExists(path));
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
                return realpath(toRealSvelteFilePath(path));
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
