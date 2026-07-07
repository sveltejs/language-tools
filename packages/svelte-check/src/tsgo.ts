import * as syncApi from '@typescript/native-preview/unstable/sync';
import * as syncAst from '@typescript/native-preview/unstable/ast';
import { pathToFileURL } from 'url';

interface PkgInfo {
    pkgJsonName: string;
    moduleName: string;
    major: number;
    minor: number;
    patch: number;
    preRelease: string | null;
    path: string;
    bin: Record<string, string>;
}

export function tryParseTsGoVersion(tsconfigPath: string): PkgInfo | null {
    // TODO: Most likely it'll eventually be released under the 'typescript' package.
    // When it happened, check where the nightly versions are released and decide which package to prioritize.

    return tryParsePkg(tsconfigPath, '@typescript/native-preview');
}

function tryParsePkg(tsconfigPath: string, name: string): PkgInfo | null {
    try {
        const pkgPath = require.resolve(name + '/package.json', {
            paths: [tsconfigPath, __dirname]
        });
        const pkg = require(pkgPath);
        const version: string = pkg.version || '';

        const parts = version.split('.');
        if (parts.length < 3) {
            return null;
        }
        const [major, minor] = parts.slice(0, 2).map((part) => parseInt(part, 10));
        const patch = parseInt(parts[2].split('-')[0], 10);
        const preRelease = version.includes('-') ? version.split('-')[1] : null;
        return {
            major,
            minor,
            patch,
            preRelease,
            pkgJsonName: pkg.name,
            moduleName: name,
            path: pkgPath,
            bin: pkg.bin || {}
        };
    } catch (e) {
        return null;
    }
}

export async function tryLoadApi(
    tsconfigPath: string,
    info: PkgInfo
): Promise<typeof syncApi | null> {
    return (
        (await tryImport(info.moduleName + '/unstable/sync', tsconfigPath)) ??
        (await tryImport(info.moduleName + '/sync', tsconfigPath))
    );
}

export async function tryLoadAst(
    tsconfigPath: string,
    info: PkgInfo
): Promise<typeof syncAst | null> {
    return (
        (await tryImport(info.moduleName + '/unstable/ast', tsconfigPath)) ??
        (await tryImport(info.moduleName + '/ast', tsconfigPath))
    );
}

async function tryImport(moduleName: string, tsconfigPath: string): Promise<any | null> {
    try {
        const modulePath = require.resolve(moduleName, {
            paths: [tsconfigPath, __dirname]
        });
        return await import(pathToFileURL(modulePath).href);
    } catch (e) {
        return null;
    }
}
