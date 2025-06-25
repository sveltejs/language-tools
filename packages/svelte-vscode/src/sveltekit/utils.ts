import { TextDecoder } from 'util';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import type { GenerateConfig } from './generateFiles/types';

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

export async function checkProjectKind(path: string): Promise<GenerateConfig['kind']> {
    const tsconfig = await findFile(path, 'tsconfig.json');
    const jsconfig = await findFile(path, 'jsconfig.json');

    const svelteVersion = await getVersionFromPackageJson('svelte');
    const withRunes = versionAtLeast(svelteVersion ?? '0.0', 5);

    const svelteKitVersion = await getVersionFromPackageJson('@sveltejs/kit');
    let withProps = versionAtLeast(svelteKitVersion ?? '0.0', 2, 16);

    const withTs = !!tsconfig && (!jsconfig || tsconfig.length >= jsconfig.length);
    let withSatisfies = false;
    if (withTs) {
        try {
            const packageJSONPath = require.resolve('typescript/package.json', {
                paths: [tsconfig]
            });
            const { version } = require(packageJSONPath);
            withSatisfies = versionAtLeast(version, 4, 9);
        } catch (e) {}
    }

    return {
        withTs,
        withSatisfies,
        withRunes,
        withProps
    };
}

function versionAtLeast(version: string, major: number, minor?: number): boolean {
    const [majorVersion, minorVersion] = version.split('.');
    return (
        (Number(majorVersion) === major && Number(minorVersion) >= (minor ?? 0)) ||
        Number(majorVersion) > major
    );
}

export async function getVersionFromPackageJson(packageName: string): Promise<string | undefined> {
    const packageJsonList = await workspace.findFiles('**/package.json', '**/node_modules/**');

    if (packageJsonList.length === 0) {
        return undefined;
    }

    for (const fileUri of packageJsonList) {
        try {
            const text = new TextDecoder().decode(await workspace.fs.readFile(fileUri));
            const pkg = JSON.parse(text);
            const svelteVersion =
                pkg.devDependencies?.[packageName] ?? pkg.dependencies?.[packageName];

            if (svelteVersion !== undefined) {
                return svelteVersion;
            }
        } catch (error) {
            console.error(error);
        }
    }

    return undefined;
}
