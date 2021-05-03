import ts from 'typescript';
import svelte2tsx from 'svelte2tsx';
import {
    ensureRealSvelteFilePath,
    isSvelteFilePath,
    isVirtualSvelteFilePath,
    toRealSvelteFilePath
} from './utils';
import { Logger } from './logger';

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(logger: Logger) {
    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(path: string) {
            return ts.sys.fileExists(ensureRealSvelteFilePath(path));
        },
        readFile(path: string) {
            if (isSvelteFilePath(path)) {
                try {
                    return svelte2tsx(ts.sys.readFile(path) || '').code;
                } catch (e) {
                    throw e;
                }
            } else {
                return ts.sys.readFile(path);
            }
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = (extensions ?? []).concat('.svelte');

            return ts.sys.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        }
    };

    if (ts.sys.realpath) {
        const realpath = ts.sys.realpath;
        svelteSys.realpath = function (path) {
            if (isVirtualSvelteFilePath(path)) {
                return realpath(toRealSvelteFilePath(path)) + '.ts';
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
