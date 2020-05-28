import ts from 'typescript';
import {
    isVirtualSvelteFilePath,
    ensureRealSvelteFilePath,
    isSvelteFilePath,
    getExtensionFromScriptKind,
} from './utils';
import { isAbsolute } from 'path';
import { DocumentSnapshot } from './DocumentSnapshot';
import { createSvelteSys } from './svelte-sys';

/**
 * Caches resolved modules.
 */
class ModuleResolutionCache {
    private cache = new Map<string, ts.ResolvedModule>();

    /**
     * Tries to get a cached module.
     */
    get(moduleName: string, containingFile: string): ts.ResolvedModule | undefined {
        return this.cache.get(this.getKey(moduleName, containingFile));
    }

    /**
     * Caches resolved module, if it is not undefined.
     */
    set(moduleName: string, containingFile: string, resolvedModule: ts.ResolvedModule | undefined) {
        if (!resolvedModule) {
            return;
        }
        this.cache.set(this.getKey(moduleName, containingFile), resolvedModule);
    }

    /**
     * Deletes module from cache. Call this if a file was deleted.
     * @param resolvedModuleName full path of the module
     */
    delete(resolvedModuleName: string): void {
        this.cache.forEach((val, key) => {
            if (val.resolvedFileName === resolvedModuleName) {
                this.cache.delete(key);
            }
        });
    }

    private getKey(moduleName: string, containingFile: string) {
        return containingFile + ':::' + ensureRealSvelteFilePath(moduleName);
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
 * @param getSvelteSnapshot A function which returns a fully preprocessed typescript/javascript snapshot
 * @param compilerOptions The typescript compiler options
 */
export function createSvelteModuleLoader(
    getSvelteSnapshot: (fileName: string) => DocumentSnapshot | undefined,
    compilerOptions: ts.CompilerOptions,
) {
    const svelteSys = createSvelteSys(getSvelteSnapshot);
    const moduleCache = new ModuleResolutionCache();

    return {
        fileExists: svelteSys.fileExists,
        readFile: svelteSys.readFile,
        deleteFromModuleCache: (path: string) => moduleCache.delete(path),
        resolveModuleNames,
    };

    function resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
    ): (ts.ResolvedModule | undefined)[] {
        return moduleNames.map((moduleName) => {
            const cachedModule = moduleCache.get(moduleName, containingFile);
            if (cachedModule) {
                return cachedModule;
            }

            const resolvedModule = resolveModuleName(moduleName, containingFile);
            moduleCache.set(moduleName, containingFile, resolvedModule);
            return resolvedModule;
        });
    }

    function resolveModuleName(
        name: string,
        containingFile: string,
    ): ts.ResolvedModule | undefined {
        // In the normal case, delegate to ts.resolveModuleName.
        // In the relative-imported.svelte case, delegate to our own svelte module loader.
        if (isAbsolute(name) || !isSvelteFilePath(name)) {
            return ts.resolveModuleName(name, containingFile, compilerOptions, ts.sys)
                .resolvedModule;
        }

        const tsResolvedModule = ts.resolveModuleName(
            name,
            containingFile,
            compilerOptions,
            svelteSys,
        ).resolvedModule;
        if (!tsResolvedModule || !isVirtualSvelteFilePath(tsResolvedModule.resolvedFileName)) {
            return tsResolvedModule;
        }

        const resolvedFileName = ensureRealSvelteFilePath(tsResolvedModule.resolvedFileName);
        const snapshot = getSvelteSnapshot(resolvedFileName);

        const resolvedSvelteModule: ts.ResolvedModuleFull = {
            extension: getExtensionFromScriptKind(snapshot && snapshot.scriptKind),
            resolvedFileName,
        };
        return resolvedSvelteModule;
    }
}
