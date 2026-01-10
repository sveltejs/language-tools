import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager } from './config-manager';
import { Logger } from './logger';
import { SvelteSnapshotManager } from './svelte-snapshots';
import { createSvelteSys } from './svelte-sys';
import { ensureRealSvelteFilePath, isSvelteFilePath, isVirtualSvelteFilePath } from './utils';

/**
 * Caches resolved modules.
 */
class ModuleResolutionCache {
    constructor(private readonly projectService: ts.server.ProjectService) {}

    private cache = new Map<string, ts.ResolvedModuleFull>();

    /**
     * Tries to get a cached module.
     */
    get(moduleName: string, containingFile: string): ts.ResolvedModuleFull | undefined {
        return this.cache.get(this.getKey(moduleName, containingFile));
    }

    /**
     * Caches resolved module, if it is not undefined.
     */
    set(
        moduleName: string,
        containingFile: string,
        resolvedModule: ts.ResolvedModuleFull | undefined
    ) {
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
        resolvedModuleName = this.projectService.toCanonicalFileName(resolvedModuleName);
        this.cache.forEach((val, key) => {
            if (
                this.projectService.toCanonicalFileName(val.resolvedFileName) === resolvedModuleName
            ) {
                this.cache.delete(key);
            }
        });
    }

    clear() {
        this.cache.clear();
    }

    private getKey(moduleName: string, containingFile: string) {
        return (
            this.projectService.toCanonicalFileName(containingFile) +
            ':::' +
            this.projectService.toCanonicalFileName(ensureRealSvelteFilePath(moduleName))
        );
    }
}

/**
 * Creates a module loader than can also resolve `.svelte` files.
 *
 * The typescript language service tries to look up other files that are referenced in the currently open svelte file.
 * For `.ts`/`.js` files this works, for `.svelte` files it does not by default.
 * Reason: The typescript language service does not know about the `.svelte` file ending,
 * so it assumes it's a normal typescript file and searches for files like `../Component.svelte.ts`, which is wrong.
 * In order to fix this, we need to wrap typescript's module resolution and reroute all `.svelte.ts` file lookups to .svelte.
 */
export function patchModuleLoader(
    logger: Logger,
    snapshotManager: SvelteSnapshotManager,
    typescript: typeof ts,
    lsHost: ts.LanguageServiceHost,
    project: ts.server.Project,
    configManager: ConfigManager
): { dispose: () => void } {
    const svelteSys = createSvelteSys(typescript, logger);
    const moduleCache = new ModuleResolutionCache(project.projectService);
    const origResolveModuleNames = lsHost.resolveModuleNames?.bind(lsHost);
    const origResolveModuleNamLiterals = lsHost.resolveModuleNameLiterals?.bind(lsHost);

    if (lsHost.resolveModuleNameLiterals) {
        lsHost.resolveModuleNameLiterals = resolveModuleNameLiterals;
    } else {
        // TODO do we need to keep this around? We're requiring 5.0 now, so TS doesn't need it,
        // but would this break when other TS plugins are used and we no longer provide it?
        lsHost.resolveModuleNames = resolveModuleNames;
    }

    const origRemoveFile = project.removeFile.bind(project);
    project.removeFile = (info, fileExists, detachFromProject) => {
        logger.log('File is being removed. Delete from cache: ', info.fileName);
        moduleCache.delete(info.fileName);
        return origRemoveFile(info, fileExists, detachFromProject);
    };

    const onConfigChanged = () => {
        moduleCache.clear();
    };
    configManager.onConfigurationChanged(onConfigChanged);

    return {
        dispose() {
            configManager.removeConfigurationChangeListener(onConfigChanged);
            moduleCache.clear();
        }
    };

    function resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
        reusedNames: string[] | undefined,
        redirectedReference: ts.ResolvedProjectReference | undefined,
        compilerOptions: ts.CompilerOptions,
        containingSourceFile?: ts.SourceFile
    ): Array<ts.ResolvedModule | undefined> {
        logger.debug('Resolving modules names for ' + containingFile);
        // Try resolving all module names with the original method first.
        // The ones that are undefined will be re-checked if they are a
        // Svelte file and if so, are resolved, too. This way we can defer
        // all module resolving logic except for Svelte files to TypeScript.
        const resolved =
            origResolveModuleNames?.(
                moduleNames,
                containingFile,
                reusedNames,
                redirectedReference,
                compilerOptions,
                containingSourceFile
            ) || Array.from<undefined>(Array(moduleNames.length));

        if (!configManager.getConfig().enable) {
            return resolved;
        }

        return resolved.map((tsResolvedModule, idx) => {
            const moduleName = moduleNames[idx];
            if (
                !isSvelteFilePath(moduleName) ||
                // corresponding .d.ts files take precedence over .svelte files
                tsResolvedModule?.resolvedFileName.endsWith('.d.ts') ||
                tsResolvedModule?.resolvedFileName.endsWith('.d.svelte.ts')
            ) {
                return tsResolvedModule;
            }

            const result = resolveSvelteModuleNameFromCache(
                moduleName,
                containingFile,
                compilerOptions
            ).resolvedModule;
            // .svelte takes precedence over .svelte.ts etc
            return result ?? tsResolvedModule;
        });
    }

    function resolveSvelteModuleName(
        name: string,
        containingFile: string,
        compilerOptions: ts.CompilerOptions
    ): ts.ResolvedModuleFull | undefined {
        const svelteResolvedModule = typescript.resolveModuleName(
            name,
            containingFile,
            compilerOptions,
            svelteSys
            // don't set mode or else .svelte imports couldn't be resolved
        ).resolvedModule;
        if (
            !svelteResolvedModule ||
            !isVirtualSvelteFilePath(svelteResolvedModule.resolvedFileName)
        ) {
            return svelteResolvedModule;
        }

        const resolvedFileName = ensureRealSvelteFilePath(svelteResolvedModule.resolvedFileName);
        logger.log('Resolved', name, 'to Svelte file', resolvedFileName);
        const snapshot = snapshotManager.create(resolvedFileName);
        if (!snapshot) {
            return undefined;
        }

        const resolvedSvelteModule: ts.ResolvedModuleFull = {
            extension: snapshot.isTsFile ? typescript.Extension.Ts : typescript.Extension.Js,
            resolvedFileName,
            isExternalLibraryImport: svelteResolvedModule.isExternalLibraryImport
        };
        return resolvedSvelteModule;
    }

    function resolveModuleNameLiterals(
        moduleLiterals: readonly ts.StringLiteralLike[],
        containingFile: string,
        redirectedReference: ts.ResolvedProjectReference | undefined,
        options: ts.CompilerOptions,
        containingSourceFile: ts.SourceFile,
        reusedNames: readonly ts.StringLiteralLike[] | undefined
    ): readonly ts.ResolvedModuleWithFailedLookupLocations[] {
        logger.debug('Resolving modules names for ' + containingFile);
        // Try resolving all module names with the original method first.
        // The ones that are undefined will be re-checked if they are a
        // Svelte file and if so, are resolved, too. This way we can defer
        // all module resolving logic except for Svelte files to TypeScript.
        const resolved =
            origResolveModuleNamLiterals?.(
                moduleLiterals,
                containingFile,
                redirectedReference,
                options,
                containingSourceFile,
                reusedNames
            ) ??
            moduleLiterals.map(
                (): ts.ResolvedModuleWithFailedLookupLocations => ({
                    resolvedModule: undefined
                })
            );

        if (!configManager.getConfig().enable) {
            return resolved;
        }

        return resolved.map((tsResolvedModule, idx) => {
            const moduleName = moduleLiterals[idx].text;
            const resolvedModule = tsResolvedModule.resolvedModule;

            if (
                !isSvelteFilePath(moduleName) ||
                // corresponding .d.ts files take precedence over .svelte files
                resolvedModule?.resolvedFileName.endsWith('.d.ts') ||
                resolvedModule?.resolvedFileName.endsWith('.d.svelte.ts')
            ) {
                return tsResolvedModule;
            }

            const result = resolveSvelteModuleNameFromCache(moduleName, containingFile, options);
            // .svelte takes precedence over .svelte.ts etc
            return result.resolvedModule ? result : tsResolvedModule;
        });
    }

    function resolveSvelteModuleNameFromCache(
        moduleName: string,
        containingFile: string,
        options: ts.CompilerOptions
    ) {
        const cachedModule = moduleCache.get(moduleName, containingFile);
        if (cachedModule) {
            return {
                resolvedModule: cachedModule
            };
        }

        const resolvedModule = resolveSvelteModuleName(moduleName, containingFile, options);

        moduleCache.set(moduleName, containingFile, resolvedModule);
        return {
            resolvedModule: resolvedModule
        };
    }
}
