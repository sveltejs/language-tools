import ts from 'typescript';
import { getLastPartOfPath } from '../../utils';
import { DocumentSnapshot } from './DocumentSnapshot';
import { createSvelteSys } from './svelte-sys';
import {
    ensureRealSvelteFilePath,
    getExtensionFromScriptKind,
    isSvelteFilePath,
    isVirtualSvelteFilePath,
    toVirtualSvelteFilePath
} from './utils';

/**
 * Caches resolved modules.
 */
class ModuleResolutionCache {
    private cache = new Map<string, ts.ResolvedModule | undefined>();

    /**
     * Tries to get a cached module.
     * Careful: `undefined` can mean either there's no match found, or that the result resolved to `undefined`.
     */
    get(moduleName: string, containingFile: string): ts.ResolvedModule | undefined {
        return this.cache.get(this.getKey(moduleName, containingFile));
    }

    /**
     * Checks if has cached module.
     */
    has(moduleName: string, containingFile: string): boolean {
        return this.cache.has(this.getKey(moduleName, containingFile));
    }

    /**
     * Caches resolved module (or undefined).
     */
    set(moduleName: string, containingFile: string, resolvedModule: ts.ResolvedModule | undefined) {
        this.cache.set(this.getKey(moduleName, containingFile), resolvedModule);
    }

    /**
     * Deletes module from cache. Call this if a file was deleted.
     * @param resolvedModuleName full path of the module
     */
    delete(resolvedModuleName: string): void {
        this.cache.forEach((val, key) => {
            if (val?.resolvedFileName === resolvedModuleName) {
                this.cache.delete(key);
            }
        });
    }

    /**
     * Deletes everything from cache that resolved to `undefined`
     * and which might match the path.
     */
    deleteUnresolvedResolutionsFromCache(path: string): void {
        const fileNameWithoutEnding = getLastPartOfPath(path).split('.').shift() || '';
        this.cache.forEach((val, key) => {
            const moduleName = key.split(':::').pop() || '';
            if (!val && moduleName.includes(fileNameWithoutEnding)) {
                this.cache.delete(key);
            }
        });
    }

    private getKey(moduleName: string, containingFile: string) {
        return containingFile + ':::' + ensureRealSvelteFilePath(moduleName);
    }
}

class ImpliedNodeFormatResolver {
    private alreadyResolved = new Map<string, ReturnType<typeof ts.getModeForResolutionAtIndex>>();

    resolve(
        importPath: string,
        importIdxInFile: number,
        sourceFile: ts.SourceFile | undefined,
        compilerOptions: ts.CompilerOptions
    ) {
        if (isSvelteFilePath(importPath)) {
            // Svelte imports should use the old resolution algorithm, else they are not found
            return undefined;
        }

        let mode = undefined;
        if (sourceFile) {
            if (!sourceFile.impliedNodeFormat && isSvelteFilePath(sourceFile.fileName)) {
                // impliedNodeFormat is not set for Svelte files, because the TS function which
                // calculates this works with a fixed set of file extensions,
                // which .svelte is obv not part of. Make it work by faking a TS file.
                if (!this.alreadyResolved.has(sourceFile.fileName)) {
                    sourceFile.impliedNodeFormat = ts.getImpliedNodeFormatForFile(
                        toVirtualSvelteFilePath(sourceFile.fileName) as any,
                        undefined,
                        ts.sys,
                        compilerOptions
                    );
                    this.alreadyResolved.set(sourceFile.fileName, sourceFile.impliedNodeFormat);
                } else {
                    sourceFile.impliedNodeFormat = this.alreadyResolved.get(sourceFile.fileName);
                }
            }
            mode = ts.getModeForResolutionAtIndex(sourceFile, importIdxInFile);
        }
        return mode;
    }
}

/**
 * Creates a module loader specifically for `.svelte` files.
 *
 * The typescript language service tries to look up other files that are referenced in the currently open svelte file.
 * For `.ts`/`.js` files this works, for `.svelte` files it does not by default.
 * Reason: The typescript language service does not know about the `.svelte` file ending,
 * so it assumes it's a normal typescript file and searches for files like `../Component.svelte.ts`, which is wrong.
 * In order to fix this, we need to wrap typescript's module resolution and reroute all `.svelte.ts` file lookups to .svelte.
 *
 * @param getSnapshot A function which returns a (in case of svelte file fully preprocessed) typescript/javascript snapshot
 * @param compilerOptions The typescript compiler options
 */
export function createSvelteModuleLoader(
    getSnapshot: (fileName: string) => DocumentSnapshot,
    compilerOptions: ts.CompilerOptions
) {
    const svelteSys = createSvelteSys(getSnapshot);
    const moduleCache = new ModuleResolutionCache();
    const impliedNodeFormatResolver = new ImpliedNodeFormatResolver();

    return {
        fileExists: svelteSys.fileExists,
        readFile: svelteSys.readFile,
        readDirectory: svelteSys.readDirectory,
        deleteFromModuleCache: (path: string) => {
            svelteSys.deleteFromCache(path);
            moduleCache.delete(path);
        },
        deleteUnresolvedResolutionsFromCache: (path: string) => {
            svelteSys.deleteFromCache(path);
            moduleCache.deleteUnresolvedResolutionsFromCache(path);
        },
        resolveModuleNames
    };

    function resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
        _reusedNames: string[] | undefined,
        _redirectedReference: ts.ResolvedProjectReference | undefined,
        _options: ts.CompilerOptions,
        containingSourceFile?: ts.SourceFile | undefined
    ): Array<ts.ResolvedModule | undefined> {
        return moduleNames.map((moduleName, index) => {
            if (moduleCache.has(moduleName, containingFile)) {
                return moduleCache.get(moduleName, containingFile);
            }

            const resolvedModule = resolveModuleName(
                moduleName,
                containingFile,
                containingSourceFile,
                index
            );
            moduleCache.set(moduleName, containingFile, resolvedModule);
            return resolvedModule;
        });
    }

    function resolveModuleName(
        name: string,
        containingFile: string,
        containingSourceFile: ts.SourceFile | undefined,
        index: number
    ): ts.ResolvedModule | undefined {
        const mode = impliedNodeFormatResolver.resolve(
            name,
            index,
            containingSourceFile,
            compilerOptions
        );
        // Delegate to the TS resolver first.
        // If that does not bring up anything, try the Svelte Module loader
        // which is able to deal with .svelte files.
        const tsResolvedModule = ts.resolveModuleName(
            name,
            containingFile,
            compilerOptions,
            ts.sys,
            undefined,
            undefined,
            mode
        ).resolvedModule;
        if (tsResolvedModule && !isVirtualSvelteFilePath(tsResolvedModule.resolvedFileName)) {
            return tsResolvedModule;
        }

        const svelteResolvedModule = ts.resolveModuleName(
            name,
            containingFile,
            compilerOptions,
            svelteSys,
            undefined,
            undefined,
            mode
        ).resolvedModule;
        if (
            !svelteResolvedModule ||
            !isVirtualSvelteFilePath(svelteResolvedModule.resolvedFileName)
        ) {
            return svelteResolvedModule;
        }

        const resolvedFileName = ensureRealSvelteFilePath(svelteResolvedModule.resolvedFileName);
        const snapshot = getSnapshot(resolvedFileName);

        const resolvedSvelteModule: ts.ResolvedModuleFull = {
            extension: getExtensionFromScriptKind(snapshot && snapshot.scriptKind),
            resolvedFileName,
            isExternalLibraryImport: svelteResolvedModule.isExternalLibraryImport
        };
        return resolvedSvelteModule;
    }
}
