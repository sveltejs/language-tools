import { basename, dirname, join, resolve } from 'path';
import type ts from 'typescript';

/**
 * Returns the path to the global svelte2tsx files that should be included in the project.
 * Creates a hidden folder in the user's node_modules if `hiddenFolderPath` is provided.
 */
export function get_global_types(
    tsSystem: ts.System,
    isSvelte3: boolean,
    sveltePath: string,
    typesPath: string,
    hiddenFolderPath?: string
): string[] {
    let svelteHtmlPath = isSvelte3 ? undefined : join(sveltePath, 'svelte-html.d.ts');
    svelteHtmlPath =
        svelteHtmlPath && tsSystem.fileExists(svelteHtmlPath) ? svelteHtmlPath : undefined;

    let svelteTsxFiles: string[];
    if (isSvelte3) {
        svelteTsxFiles = ['./svelte-shims.d.ts', './svelte-jsx.d.ts', './svelte-native-jsx.d.ts'];
    } else {
        svelteTsxFiles = ['./svelte-shims-v4.d.ts', './svelte-native-jsx.d.ts'];
        if (!svelteHtmlPath) {
            svelteTsxFiles.push('./svelte-jsx-v4.d.ts');
        }
    }
    svelteTsxFiles = svelteTsxFiles.map((f) => tsSystem.resolvePath(resolve(typesPath, f)));

    if (hiddenFolderPath) {
        try {
            // IDE context - the `import('svelte')` statements inside the d.ts files will load the Svelte version of
            // the extension, which can cause all sorts of problems. Therefore put the files into a hidden folder in
            // the user's node_modules, preferably next to the Svelte package.
            let path = dirname(sveltePath);

            if (!tsSystem.directoryExists(resolve(path, 'node_modules'))) {
                path = hiddenFolderPath;

                while (path && !tsSystem.directoryExists(resolve(path, 'node_modules'))) {
                    const parent = dirname(path);
                    if (path === parent) {
                        path = '';
                        break;
                    }
                    path = parent;
                }
            }

            if (path) {
                const hiddenPath = resolve(path, 'node_modules/.svelte2tsx-language-server-files');
                const newFiles = [];
                for (const f of svelteTsxFiles) {
                    const hiddenFile = resolve(hiddenPath, basename(f));
                    const existing = tsSystem.readFile(hiddenFile);
                    const toWrite = tsSystem.readFile(f);

                    if (!toWrite) {
                        throw new Error(`Could not read file: ${f}`);
                    }

                    if (existing !== toWrite) {
                        tsSystem.writeFile(hiddenFile, toWrite);
                        // TS doesn't throw an error if the file wasn't written
                        if (!tsSystem.fileExists(hiddenFile)) {
                            throw new Error(`Could not write file: ${hiddenFile}`);
                        }
                    }

                    newFiles.push(hiddenFile);
                }
                svelteTsxFiles = newFiles;
            }
        } catch (e) {}
    }

    if (svelteHtmlPath) {
        svelteTsxFiles.push(tsSystem.resolvePath(resolve(typesPath, svelteHtmlPath)));
    }

    return svelteTsxFiles;
}
