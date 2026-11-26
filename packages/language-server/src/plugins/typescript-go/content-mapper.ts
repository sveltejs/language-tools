import fs from 'fs';
import { fdir } from 'fdir';
import path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver-types';
import { urlToPath } from '../../utils';

export interface ContentMapperConfigCheck {
    /** The first `tsconfig*.json`/`jsconfig*.json` of the workspace that mentions the Svelte content mapper */
    configFile?: string;
}

/**
 * Content mapper mode is decided by text, without TypeScript: the `tsconfig*.json`/`jsconfig*.json`
 * files of the workspace folders (breadth first, without `node_modules` and dot-directories) whose
 * text mentions `contentMappers` and `svelte`. Whether TypeScript 7 can load the mapper is not
 * checked; if it can't, Svelte files get no TypeScript features (TypeScript reports the error on
 * the config).
 *
 * Known limit: a registration that is only inherited through `extends` from a file with another
 * name, from a dot-directory (`.svelte-kit/tsconfig.json`) or from a package is not found.
 */
export function findContentMapperCandidates(
    workspaceFolders: readonly WorkspaceFolder[]
): string[] {
    const candidates: string[] = [];
    for (const folder of workspaceFolders) {
        const folderPath = urlToPath(folder.uri);
        if (!folderPath) {
            continue;
        }
        for (const configFile of findProjectConfigs(path.resolve(folderPath))) {
            let text: string;
            try {
                text = fs.readFileSync(configFile, 'utf-8');
            } catch {
                continue;
            }
            if (text.includes('contentMappers') && /svelte/i.test(text)) {
                candidates.push(configFile);
            }
        }
    }
    return candidates;
}

export function checkContentMapperConfig(
    workspaceFolders: readonly WorkspaceFolder[]
): ContentMapperConfigCheck {
    const [configFile] = findContentMapperCandidates(workspaceFolders);
    return { configFile };
}

const projectConfigName = /^(tsconfig|jsconfig).*\.json$/;

/** No `node_modules` or dot-directories; symlinked directories aren't followed. Shortest first */
export function findProjectConfigs(root: string): string[] {
    return new fdir()
        .withFullPaths()
        .withMaxDepth(20)
        .exclude((dirName) => dirName === 'node_modules' || dirName.startsWith('.'))
        .filter((filePath) => projectConfigName.test(path.basename(filePath)))
        .crawl(root)
        .sync()
        .sort((a, b) => a.length - b.length || a.localeCompare(b));
}
