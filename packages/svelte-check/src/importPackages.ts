import { pathToFileURL } from 'node:url'
import type ts from 'typescript';

export function getTypeScriptPackageInfo(root: string): PkgInfo | null {
    return tryParsePkg(root, 'typescript');
}

export function importAliasedTs6(root: string): Promise<typeof ts | null> {
    return tryImport('@typescript/typescript6', root);
}

export function importTypeScript(root: string): Promise<typeof ts | null> {
    return tryImport('typescript', root);
}

export interface PkgInfo {
    name: string;
    major: number;
    minor: number;
    patch: number;
    preRelease: string | null;
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
        return { major, minor, patch, preRelease, name: pkg.name };
    } catch (e) {
        return null;
    }
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