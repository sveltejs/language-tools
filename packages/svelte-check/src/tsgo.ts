import * as syncApi from '@typescript/native-preview/sync';
import * as syncAst from '@typescript/native-preview/ast';

export function tryLoadApi(tsconfigPath: string): typeof syncApi | null {
    try {
        const apiPath = require.resolve('@typescript/native-preview/sync', {
            paths: [tsconfigPath, __dirname]
        });
        const syncApiModule = require(apiPath);
        return syncApiModule;
    } catch (e) {
        return null;
    }
}

export function tryLoadAst(tsconfigPath: string): typeof syncAst | null {
    try {
        const astPath = require.resolve('@typescript/native-preview/ast', {
            paths: [tsconfigPath, __dirname]
        });
        const syncAstModule = require(astPath);
        return syncAstModule;
    } catch (e) {
        return null;
    }
}