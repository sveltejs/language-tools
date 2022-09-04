import * as path from 'path';
import { TextDecoder } from 'util';
import { Uri, workspace } from 'vscode';

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

export async function checkIfSvelteKitProject(path: string) {
    try {
        const packageJsonPath = await findFile(path, 'package.json');
        if (!packageJsonPath) {
            return false;
        }
        const packageJson = await workspace.fs.readFile(Uri.file(packageJsonPath));
        const packageJsonContent = JSON.parse(new TextDecoder().decode(packageJson));

        return (
            !!packageJsonContent.dependencies['@sveltejs/kit'] ||
            !!packageJsonContent.devDependencies['@sveltejs/kit']
        );
    } catch (err) {
        return false;
    }
}
