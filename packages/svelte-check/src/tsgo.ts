import * as syncApi from '@typescript/native-preview/unstable/sync';
import * as syncAst from '@typescript/native-preview/unstable/ast';
import { pathToFileURL } from 'url';

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
