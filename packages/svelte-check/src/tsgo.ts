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
    const pkg =
        tryParsePkg(tsconfigPath, 'typescript-7') ??
        tryParsePkg(tsconfigPath, '@typescript/native-preview');

    if (
        pkg &&
        (pkg.pkgJsonName === 'typescript' || pkg.pkgJsonName === '@typescript/native-preview') &&
        pkg.major >= 7
    ) {
        return pkg;
    }

    return null;
}

export function formatTsGoNotFoundError(flagName: string) {
    return (
        `svelte-check ${flagName} requires TypeScript 7 to be installed in the workspace.` +
        `You can setup TypeScript 7 with npm alias with the following command.\n` +
        `npm install --save-dev typescript@~6 typescript-7@npm:typescript@7\n`
    );
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
