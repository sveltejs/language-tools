import * as syncApi from '@typescript/native-preview/unstable/sync';
import * as syncAst from '@typescript/native-preview/unstable/ast';
import { pathToFileURL } from 'url';

export function tryLoadVersion(
    tsconfigPath: string
): { major: number; minor: number; patch: number; preRelease: string | null } | null {
    try {
        const apiPath = require.resolve('@typescript/native-preview/package.json', {
            paths: [tsconfigPath, __dirname]
        });
        const pkg = require(apiPath);
        const version: string = pkg.version || '';

        const parts = version.split('.');
        if (parts.length < 3) {
            return null;
        }
        const [major, minor] = parts.slice(0, 2).map((part) => parseInt(part, 10));
        const patch = parseInt(parts[2].split('-')[0], 10);
        const preRelease = version.includes('-') ? version.split('-')[1] : null;
        return { major, minor, patch, preRelease };
    } catch (e) {
        return null;
    }
}

export async function tryLoadApi(tsconfigPath: string): Promise<typeof syncApi | null> {
    try {
        const apiPath = require.resolve('@typescript/native-preview/unstable/sync', {
            paths: [tsconfigPath, __dirname]
        });
        const syncApiModule = await import(pathToFileURL(apiPath).href);
        return syncApiModule;
    } catch (e) {
        try {
            const apiPath = require.resolve('@typescript/native-preview/sync', {
                paths: [tsconfigPath, __dirname]
            });
            const syncApiModule = await import(pathToFileURL(apiPath).href);
            return syncApiModule;
        } catch (e) {
            return null;
        }
    }
}

export async function tryLoadAst(tsconfigPath: string): Promise<typeof syncAst | null> {
    try {
        const astPath = require.resolve('@typescript/native-preview/unstable/ast', {
            paths: [tsconfigPath, __dirname]
        });
        const syncAstModule = await import(pathToFileURL(astPath).href);
        return syncAstModule;
    } catch (e) {
        try {
            const apiPath = require.resolve('@typescript/native-preview/sync', {
                paths: [tsconfigPath, __dirname]
            });
            const syncApiModule = await import(pathToFileURL(apiPath).href);
            return syncApiModule;
        } catch (e) {
            return null;
        }
    }
}
