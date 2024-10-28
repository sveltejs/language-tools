import { TextDecoder } from 'util';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import { IsSvelte5Plus, ProjectType } from './generateFiles/types';

export async function fileExists(file: string) {
    try {
        await workspace.fs.stat(Uri.file(file));
        return true;
    } catch (err) {
        return false;
    }
}

export async function findFile(searchPath: string, fileName: string) {
    for (;;) {
        const filePath = path.join(searchPath, fileName);
        if (await fileExists(filePath)) {
            return filePath;
        }
        const parentPath = path.dirname(searchPath);
        if (parentPath === searchPath) {
            return;
        }
        searchPath = parentPath;
    }
}

export async function checkProjectType(path: string): Promise<ProjectType> {
    const tsconfig = await findFile(path, 'tsconfig.json');
    const jsconfig = await findFile(path, 'jsconfig.json');
    const svelteVersion = await getSvelteVersionFromPackageJson();
    const isSv5Plus = isSvelte5Plus(svelteVersion);
    const isTs = !!tsconfig && (!jsconfig || tsconfig.length >= jsconfig.length);
    if (isTs) {
        try {
            const packageJSONPath = require.resolve('typescript/package.json', {
                paths: [tsconfig]
            });
            const { version } = require(packageJSONPath);
            const [major, minor] = version.split('.');
            if ((Number(major) === 4 && Number(minor) >= 9) || Number(major) > 4) {
                return isSv5Plus ? ProjectType.TS_SATISFIES_SV5 : ProjectType.TS_SATISFIES;
            } else {
                return isSv5Plus ? ProjectType.TS_SV5 : ProjectType.TS;
            }
        } catch (e) {
            return isSv5Plus ? ProjectType.TS_SV5 : ProjectType.TS;
        }
    } else {
        return isSv5Plus ? ProjectType.JS_SV5 : ProjectType.JS;
    }
}

export function isSvelte5Plus(version: string | undefined): IsSvelte5Plus {
    if (!version) return IsSvelte5Plus.no;

    return version.split('.')[0] >= '5';
}

export async function getSvelteVersionFromPackageJson(): Promise<string | undefined> {
    const packageJsonList = await workspace.findFiles('**/package.json', '**/node_modules/**');

    if (packageJsonList.length === 0) {
        return undefined;
    }

    for (const fileUri of packageJsonList) {
        try {
            const text = new TextDecoder().decode(await workspace.fs.readFile(fileUri));
            const pkg = JSON.parse(text);
            const svelteVersion = pkg.devDependencies?.svelte ?? pkg.dependencies?.svelte;

            if (svelteVersion !== undefined) {
                return svelteVersion;
            }
        } catch (error) {
            console.error(error);
        }
    }

    return undefined;
}
