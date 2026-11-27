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
 * files of the workspace folders (without `node_modules` and dot-directories) whose text, or the
 * text of a config they `extends` (followed in turn), mentions `contentMappers` and `svelte`.
 * Whether TypeScript 7 can load the mapper is not checked; if it can't, Svelte files get no
 * TypeScript features (TypeScript reports the error on the config).
 *
 * Known limit: `extends` is read with a regex and resolved like TypeScript only for paths and plain
 * package paths (`pkg`, `pkg/tsconfig.json`), not through a package's `exports` or `tsconfig` field.
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
            if (mentionsSvelteContentMapper(configFile, new Set())) {
                candidates.push(configFile);
            }
        }
    }
    return candidates;
}

function mentionsSvelteContentMapper(configFile: string, visited: Set<string>): boolean {
    if (visited.has(configFile)) {
        return false;
    }
    visited.add(configFile);
    let text: string;
    try {
        text = fs.readFileSync(configFile, 'utf-8');
    } catch {
        return false;
    }
    if (text.includes('contentMappers') && /svelte/i.test(text)) {
        return true;
    }
    return getExtends(text).some((specifier) => {
        const extended = resolveExtends(specifier, path.dirname(configFile));
        return !!extended && mentionsSvelteContentMapper(extended, visited);
    });
}

/** `"extends": "…"` or `"extends": ["…", …]` */
function getExtends(text: string): string[] {
    const value = /"extends"\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\])/.exec(text)?.[1];
    try {
        const parsed = value ? JSON.parse(value) : [];
        return (Array.isArray(parsed) ? parsed : [parsed]).filter((s) => typeof s === 'string');
    } catch {
        return [];
    }
}

/** Like TypeScript: a path (`.json` may be omitted), or a package (its `tsconfig.json` by default) */
function resolveExtends(specifier: string, dir: string): string | undefined {
    if (path.isAbsolute(specifier) || /^\.\.?($|[\\/])/.test(specifier)) {
        const file = path.resolve(dir, specifier);
        return [file, file + '.json'].find((f) => fs.existsSync(f));
    }
    for (const request of [`${specifier}/tsconfig.json`, specifier, `${specifier}.json`]) {
        try {
            return require.resolve(request, { paths: [dir] });
        } catch {
            // not this one
        }
    }
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
