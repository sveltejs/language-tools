import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from './logger';
import { ensureRealSvelteFilePath, isVirtualSvelteFilePath, toRealSvelteFilePath } from './utils';

type _ts = typeof ts;

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(ts: _ts, logger: Logger) {
    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(path: string) {
            return ts.sys.fileExists(ensureRealSvelteFilePath(path));
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = (extensions ?? []).concat('.svelte');

            return ts.sys.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        },
        readFile(path, encoding) {
            // imba typescript plugin patch this with Object.defineProperty
            // and copying the property descriptor from a class that extends the original ts.sys
            // so we explicitly define it here
            return ts.sys.readFile(path, encoding);
        }
    };

    if (ts.sys.realpath) {
        const realpath = ts.sys.realpath;
        svelteSys.realpath = function (path) {
            if (isVirtualSvelteFilePath(path)) {
                return realpath(toRealSvelteFilePath(path));
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
