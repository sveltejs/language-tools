import { DocumentSnapshot } from './DocumentSnapshot';
import ts from 'typescript';
import { ensureRealSvelteFilePath, isVirtualSvelteFilePath, toRealSvelteFilePath } from './utils';

/**
 * This should only be accessed by TS svelte module resolution.
 */
export function createSvelteSys(
    getSvelteSnapshot: (fileName: string) => DocumentSnapshot | undefined,
) {
    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(path: string) {
            return ts.sys.fileExists(ensureRealSvelteFilePath(path));
        },
        readFile(path, encoding) {
            if (isVirtualSvelteFilePath(path)) {
                const fileText = ts.sys.readFile(toRealSvelteFilePath(path), encoding);
                const snapshot = getSvelteSnapshot(fileText!);
                return fileText ? snapshot?.getText(0, snapshot.getLength()) : fileText;
            }
            const fileText = ts.sys.readFile(path, encoding);
            return fileText;
        },
    };

    if (ts.sys.realpath) {
        const realpath = ts.sys.realpath;
        svelteSys.realpath = function(path) {
            if (isVirtualSvelteFilePath(path)) {
                return realpath(toRealSvelteFilePath(path)) + '.ts';
            }
            return realpath(path);
        };
    }

    return svelteSys;
}
