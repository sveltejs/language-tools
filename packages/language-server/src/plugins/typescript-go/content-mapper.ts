import path from 'path';
import ts from 'typescript';
import { WorkspaceFolder } from 'vscode-languageserver-types';
import { urlToPath } from '../../utils';

/**
 * Only enable content-mapper mode when content mapper is configured in one of the tsconfig files
 */
export function contentMapperEnableCheck(workspaceFolders: WorkspaceFolder[]) {
    const disableProjectFileSearchHost: ts.ParseConfigHost = {
        ...ts.sys,
        readDirectory() {
            return [];
        }
    };

    const extendedConfigCache = new Map();
    for (const workspaceFolder of workspaceFolders) {
        const workspacePath = urlToPath(workspaceFolder.uri);
        if (!workspacePath) {
            continue;
        }
        const files = ts.sys.readDirectory(
            workspacePath,
            ['.json'],
            ['node_modules'],
            ['**/tsconfig.json', '**/jsconfig.json']
        );
        console.log(files)

        for (const file of files) {
            const res = ts.parseJsonSourceFileConfigFileContent(
                ts.readJsonConfigFile(file, ts.sys.readFile),
                disableProjectFileSearchHost,
                path.dirname(file),
                /*existingOptions*/ undefined,
                file,
                /*resolutionStack*/ undefined,
                [],
                extendedConfigCache
            );
            console.log(res.raw)

            if (
                typeof res.raw.contentMappers === 'object' &&
                Array.isArray(res.raw.contentMappers)
            ) {
                const svelteConfig = res.raw.contentMappers.find(
                    (mapper: { extensions: string[] }) => mapper.extensions.includes('.svelte')
                );
                if (svelteConfig) {
                    return true;
                }
            }
        }
    }
    return false;
}
