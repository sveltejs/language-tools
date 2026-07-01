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
}

export function parseTsGoVersion(tsconfigPath: string): PkgInfo {
    const preview = tryParsePkg(tsconfigPath, '@typescript/native-preview');
    if (preview) {
        return preview;
    }
    const ts7Alias = tryParsePkg(tsconfigPath, 'typescript-7');
    if (
        ts7Alias &&
        (ts7Alias.pkgJsonName === 'typescript' ||
            ts7Alias.pkgJsonName === '@typescript/native-preview') &&
        ts7Alias.major >= 7
    ) {
        return ts7Alias;
    }

    const message =
        'TypeScript 7 not installed in the workspace.' +
        'Please visit https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check#typescript-7-supports for instructions';

    throw new Error(message);
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
            path: pkgPath
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
