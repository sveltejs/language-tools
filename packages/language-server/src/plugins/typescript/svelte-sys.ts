import { DocumentSnapshot } from './DocumentSnapshot';
import ts from 'typescript';
import { ensureRealSvelteFilePath, isVirtualSvelteFilePath, toRealSvelteFilePath } from './utils';

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(getSnapshot: (fileName: string) => DocumentSnapshot) {
    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(path: string) {
            return ts.sys.fileExists(ensureRealSvelteFilePath(path));
        },
        readFile(path: string) {
            const snapshot = getSnapshot(path);
            return snapshot.getText(0, snapshot.getLength());
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
