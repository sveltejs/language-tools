import { basename, dirname, join, resolve } from 'path';
import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';
import { getPackageInfo, importSvelte } from '../../importPackage';
import { Document } from '../../lib/documents';
import { configLoader } from '../../lib/documents/configLoader';
import { FileMap, FileSet } from '../../lib/documents/fileCollection';
import { Logger } from '../../logger';
import { createGetCanonicalFileName, normalizePath, urlToPath } from '../../utils';
import { DocumentSnapshot, SvelteSnapshotOptions } from './DocumentSnapshot';
import { createSvelteModuleLoader } from './module-loader';
import {
    GlobalSnapshotsManager,
    ignoredBuildDirectories,
    SnapshotManager
} from './SnapshotManager';
import {
    ensureRealSvelteFilePath,
    findTsConfigPath,
    getNearestWorkspaceUri,
    hasTsExtensions,
    isSvelteFilePath
} from './utils';
import { createProject, ProjectService } from './serviceCache';

export interface LanguageServiceContainer {
    readonly tsconfigPath: string;
    readonly compilerOptions: ts.CompilerOptions;
    readonly configErrors: ts.Diagnostic[];
    /**
     * @internal Public for tests only
     */
    readonly snapshotManager: SnapshotManager;
    getService(skipSynchronize?: boolean): ts.LanguageService;
    updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot;
    deleteSnapshot(filePath: string): void;
    invalidateModuleCache(filePath: string): void;
    updateProjectFiles(): void;
    updateTsOrJsFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void;
    /**
     * Checks if a file is present in the project.
     * Unlike `fileBelongsToProject`, this doesn't run a file search on disk.
     */
    hasFile(filePath: string): boolean;
    /**
     * Careful, don't call often, or it will hurt performance.
     * Only works for TS versions that have ScriptKind.Deferred
     */
    fileBelongsToProject(filePath: string, isNew: boolean): boolean;
    onAutoImportProviderSettingsChanged(): void;
    onPackageJsonChange(packageJsonPath: string): void;

    dispose(): void;
}

declare module 'typescript' {
    interface LanguageServiceHost {
        /**
         * @internal
         * This is needed for the languageService program to know that there is a new file
         * that might change the module resolution results
         */
        hasInvalidatedResolutions?: (sourceFile: string) => boolean;

        getModuleResolutionCache?(): ts.ModuleResolutionCache;
    }

    interface ResolvedModuleWithFailedLookupLocations {
        /** @internal */
        failedLookupLocations?: string[];
        /** @internal */
        affectingLocations?: string[];
        /** @internal */
        resolutionDiagnostics?: ts.Diagnostic[];
        /**
         * @internal
         * Used to issue a diagnostic if typings for a non-relative import couldn't be found
         * while respecting package.json `exports`, but were found when disabling `exports`.
         */
        node10Result?: string;
    }
}

const maxProgramSizeForNonTsFiles = 20 * 1024 * 1024; // 20 MB
const services = new FileMap<Promise<LanguageServiceContainer>>();
const serviceSizeMap = new FileMap<number>();
const configWatchers = new FileMap<ts.FileWatcher>();
const extendedConfigWatchers = new FileMap<ts.FileWatcher>();
const extendedConfigToTsConfigPath = new FileMap<FileSet>();
const configFileModifiedTime = new FileMap<Date | undefined>();
const configFileForOpenFiles = new FileMap<string>();
const pendingReloads = new FileSet();
const documentRegistries = new Map<string, ts.DocumentRegistry>();

/**
 * For testing only: Reset the cache for services.
 * Try to refactor this some day so that this file provides
 * a setup function which creates all this nicely instead.
 */
export function __resetCache() {
    services.clear();
    serviceSizeMap.clear();
    configFileForOpenFiles.clear();
}

export interface LanguageServiceDocumentContext {
    ambientTypesSource: string;
    transformOnTemplateError: boolean;
    createDocument: (fileName: string, content: string) => Document;
    globalSnapshotsManager: GlobalSnapshotsManager;
    notifyExceedSizeLimit: (() => void) | undefined;
    extendedConfigCache: Map<string, ts.ExtendedConfigCacheEntry>;
    onProjectReloaded: (() => void) | undefined;
    watchTsConfig: boolean;
    tsSystem: ts.System;
    projectService: ProjectService | undefined;
}

export async function getService(
    path: string,
    workspaceUris: string[],
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const getCanonicalFileName = createGetCanonicalFileName(
        docContext.tsSystem.useCaseSensitiveFileNames
    );

    const tsconfigPath =
        configFileForOpenFiles.get(path) ??
        findTsConfigPath(path, workspaceUris, docContext.tsSystem.fileExists, getCanonicalFileName);

    if (tsconfigPath) {
        configFileForOpenFiles.set(path, tsconfigPath);
        return getServiceForTsconfig(tsconfigPath, dirname(tsconfigPath), docContext);
    }

    // Find closer boundary: workspace uri or node_modules
    const nearestWorkspaceUri = getNearestWorkspaceUri(workspaceUris, path, getCanonicalFileName);
    const lastNodeModulesIdx = path.split('/').lastIndexOf('node_modules') + 2;
    const nearestNodeModulesBoundary =
        lastNodeModulesIdx === 1
            ? undefined
            : path.split('/').slice(0, lastNodeModulesIdx).join('/');
    const nearestBoundary =
        (nearestNodeModulesBoundary?.length ?? 0) > (nearestWorkspaceUri?.length ?? 0)
            ? nearestNodeModulesBoundary
            : nearestWorkspaceUri;

    return getServiceForTsconfig(
        tsconfigPath,
        (nearestBoundary && urlToPath(nearestBoundary)) ??
            docContext.tsSystem.getCurrentDirectory(),
        docContext
    );
}

export async function forAllServices(
    cb: (service: LanguageServiceContainer) => any
): Promise<void> {
    for (const service of services.values()) {
        cb(await service);
    }
}

/**
 * @param tsconfigPath has to be absolute
 * @param docContext
 */
export async function getServiceForTsconfig(
    tsconfigPath: string,
    workspacePath: string,
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const tsconfigPathOrWorkspacePath = tsconfigPath || workspacePath;
    const reloading = pendingReloads.has(tsconfigPath);

    let service: LanguageServiceContainer;

    if (reloading || !services.has(tsconfigPathOrWorkspacePath)) {
        if (reloading) {
            Logger.log('Reloading ts service at ', tsconfigPath, ' due to config updated');
        } else {
            Logger.log('Initialize new ts service at ', tsconfigPath);
        }

        pendingReloads.delete(tsconfigPath);
        const newService = createLanguageService(tsconfigPath, workspacePath, docContext);
        services.set(tsconfigPathOrWorkspacePath, newService);
        service = await newService;
    } else {
        service = await services.get(tsconfigPathOrWorkspacePath)!;
    }

    return service;
}

async function createLanguageService(
    tsconfigPath: string,
    workspacePath: string,
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const { tsSystem } = docContext;

    const {
        options: compilerOptions,
        errors: configErrors,
        fileNames: files,
        projectReferences,
        raw,
        extendedConfigPaths
    } = getParsedConfig();
    // raw is the tsconfig merged with extending config
    // see: https://github.com/microsoft/TypeScript/blob/08e4f369fbb2a5f0c30dee973618d65e6f7f09f8/src/compiler/commandLineParser.ts#L2537
    const snapshotManager = new SnapshotManager(
        docContext.globalSnapshotsManager,
        raw,
        workspacePath,
        files
    );

    // Load all configs within the tsconfig scope and the one above so that they are all loaded
    // by the time they need to be accessed synchronously by DocumentSnapshots.
    await configLoader.loadConfigs(workspacePath);

    const svelteModuleLoader = createSvelteModuleLoader(getSnapshot, compilerOptions, tsSystem, ts);

    let svelteTsPath: string;
    try {
        // For when svelte2tsx/svelte-check is part of node_modules, for example VS Code extension
        svelteTsPath = dirname(require.resolve(docContext.ambientTypesSource));
    } catch (e) {
        // Fall back to dirname
        svelteTsPath = __dirname;
    }
    const sveltePackageInfo = getPackageInfo('svelte', tsconfigPath || workspacePath);
    // Svelte 5 has new features, but we don't want to add the new compiler into language-tools. In the future it's probably
    // best to shift more and more of this into user's node_modules for better handling of multiple Svelte versions.
    const svelteCompiler =
        sveltePackageInfo.version.major >= 5
            ? importSvelte(tsconfigPath || workspacePath)
            : undefined;

    const isSvelte3 = sveltePackageInfo.version.major === 3;
    const svelteHtmlDeclaration = isSvelte3
        ? undefined
        : join(sveltePackageInfo.path, 'svelte-html.d.ts');
    const svelteHtmlFallbackIfNotExist =
        svelteHtmlDeclaration && tsSystem.fileExists(svelteHtmlDeclaration)
            ? svelteHtmlDeclaration
            : './svelte-jsx-v4.d.ts';

    const changedFilesForExportCache = new Set<string>();

    const svelteTsxFiles = (
        isSvelte3
            ? ['./svelte-shims.d.ts', './svelte-jsx.d.ts', './svelte-native-jsx.d.ts']
            : ['./svelte-shims-v4.d.ts', svelteHtmlFallbackIfNotExist, './svelte-native-jsx.d.ts']
    ).map((f) => tsSystem.resolvePath(resolve(svelteTsPath, f)));

    let languageServiceReducedMode = false;
    let projectVersion = 0;
    let dirty = false;

    const getCanonicalFileName = createGetCanonicalFileName(tsSystem.useCaseSensitiveFileNames);

    const host: ts.LanguageServiceHost = {
        log: (message) => Logger.debug(`[ts] ${message}`),
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames,
        getScriptVersion: (fileName: string) =>
            getSnapshotIfExists(fileName)?.version.toString() || '',
        getScriptSnapshot: getSnapshotIfExists,
        getCurrentDirectory: () => workspacePath,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        fileExists: svelteModuleLoader.fileExists,
        readFile: svelteModuleLoader.readFile,
        resolveModuleNames: svelteModuleLoader.resolveModuleNames,
        readDirectory: svelteModuleLoader.readDirectory,
        getDirectories: tsSystem.getDirectories,
        getProjectReferences: () => projectReferences,
        useCaseSensitiveFileNames: () => tsSystem.useCaseSensitiveFileNames,
        getScriptKind: (fileName: string) => getSnapshot(fileName).scriptKind,
        getProjectVersion: () => projectVersion.toString(),
        getNewLine: () => tsSystem.newLine,
        resolveTypeReferenceDirectiveReferences:
            svelteModuleLoader.resolveTypeReferenceDirectiveReferences,
        hasInvalidatedResolutions: svelteModuleLoader.mightHaveInvalidatedResolutions,
        getModuleResolutionCache: svelteModuleLoader.getModuleResolutionCache,
        useSourceOfProjectReferenceRedirect() {
            return !languageServiceReducedMode;
        },
    };

    const documentRegistry = getOrCreateDocumentRegistry(
        host.getCurrentDirectory(),
        tsSystem.useCaseSensitiveFileNames
    );

    const transformationConfig: SvelteSnapshotOptions = {
        parse: svelteCompiler?.parse,
        version: svelteCompiler?.VERSION,
        transformOnTemplateError: docContext.transformOnTemplateError,
        typingsNamespace: raw?.svelteOptions?.namespace || 'svelteHTML'
    };

    const project = initLsCacheProject();
    const languageService = ts.createLanguageService(host, documentRegistry);

    docContext.globalSnapshotsManager.onChange(scheduleUpdate);

    reduceLanguageServiceCapabilityIfFileSizeTooBig();
    updateExtendedConfigDependents();
    watchConfigFile();

    return {
        tsconfigPath,
        compilerOptions,
        configErrors,
        getService,
        updateSnapshot,
        deleteSnapshot,
        updateProjectFiles,
        updateTsOrJsFile,
        hasFile,
        fileBelongsToProject,
        snapshotManager,
        invalidateModuleCache,
        onAutoImportProviderSettingsChanged,
        onPackageJsonChange,
        dispose
    };

    function getService(skipSynchronize?: boolean) {
        if (!skipSynchronize) {
            updateIfDirty();
        }

        return languageService;
    }

    function deleteSnapshot(filePath: string): void {
        svelteModuleLoader.deleteFromModuleCache(filePath);
        snapshotManager.delete(filePath);
        configFileForOpenFiles.delete(filePath);
    }

    function invalidateModuleCache(filePath: string) {
        svelteModuleLoader.deleteFromModuleCache(filePath);
        svelteModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);

        scheduleUpdate(filePath);
    }

    function updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot {
        return typeof documentOrFilePath === 'string'
            ? updateSnapshotFromFilePath(documentOrFilePath)
            : updateSnapshotFromDocument(documentOrFilePath);
    }

    function updateSnapshotFromDocument(document: Document): DocumentSnapshot {
        const filePath = document.getFilePath() || '';
        const prevSnapshot = snapshotManager.get(filePath);
        if (prevSnapshot?.version === document.version) {
            return prevSnapshot;
        }

        if (!prevSnapshot) {
            svelteModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
        }

        const newSnapshot = DocumentSnapshot.fromDocument(document, transformationConfig);

        snapshotManager.set(filePath, newSnapshot);

        return newSnapshot;
    }

    function updateSnapshotFromFilePath(filePath: string): DocumentSnapshot {
        const prevSnapshot = snapshotManager.get(filePath);
        if (prevSnapshot) {
            return prevSnapshot;
        }

        return createSnapshot(filePath);
    }

    /**
     * Deleted files will still be requested during the program update.
     * Don't create snapshots for them.
     * Otherwise, deleteUnresolvedResolutionsFromCache won't be called when the file is created again
     */
    function getSnapshotIfExists(fileName: string): DocumentSnapshot | undefined {
        const svelteFileName = ensureRealSvelteFilePath(fileName);

        let doc = snapshotManager.get(fileName) ?? snapshotManager.get(svelteFileName);
        if (doc) {
            return doc;
        }

        if (!svelteModuleLoader.fileExists(fileName)) {
            return undefined;
        }

        return createSnapshot(
            svelteModuleLoader.svelteFileExists(fileName) ? svelteFileName : fileName
        );
    }

    function getSnapshot(fileName: string): DocumentSnapshot {
        const svelteFileName = ensureRealSvelteFilePath(fileName);

        let doc = snapshotManager.get(fileName) ?? snapshotManager.get(svelteFileName);
        if (doc) {
            return doc;
        }

        return createSnapshot(fileName);
    }

    function createSnapshot(fileName: string) {
        svelteModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
        const doc = DocumentSnapshot.fromFilePath(
            fileName,
            docContext.createDocument,
            transformationConfig,
            tsSystem
        );
        snapshotManager.set(fileName, doc);
        return doc;
    }

    function updateProjectFiles(): void {
        scheduleUpdate();
        const projectFileCountBefore = snapshotManager.getProjectFileNames().length;
        snapshotManager.updateProjectFiles();
        const projectFileCountAfter = snapshotManager.getProjectFileNames().length;

        if (projectFileCountAfter <= projectFileCountBefore) {
            return;
        }

        reduceLanguageServiceCapabilityIfFileSizeTooBig();
    }

    function getScriptFileNames() {
        const projectFiles = languageServiceReducedMode
            ? []
            : snapshotManager.getProjectFileNames();
        const canonicalProjectFileNames = new Set(projectFiles.map(getCanonicalFileName));

        return Array.from(
            new Set([
                ...projectFiles,
                // project file is read from the file system so it's more likely to have
                // the correct casing
                ...snapshotManager
                    .getClientFileNames()
                    .filter((file) => !canonicalProjectFileNames.has(getCanonicalFileName(file))),
                ...svelteTsxFiles
            ])
        );
    }

    function hasFile(filePath: string): boolean {
        return snapshotManager.has(filePath);
    }

    function fileBelongsToProject(filePath: string, isNew: boolean): boolean {
        filePath = normalizePath(filePath);
        return hasFile(filePath) || (isNew && getParsedConfig().fileNames.includes(filePath));
    }

    function updateTsOrJsFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void {
        if (!snapshotManager.has(fileName)) {
            svelteModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
        }
        snapshotManager.updateTsOrJsFile(fileName, changes);
    }

    function getParsedConfig() {
        const forcedCompilerOptions: ts.CompilerOptions = {
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.Latest,
            allowJs: true,
            noEmit: true,
            declaration: false,
            skipLibCheck: true
        };

        // always let ts parse config to get default compilerOption
        let configJson =
            (tsconfigPath && ts.readConfigFile(tsconfigPath, tsSystem.readFile).config) ||
            getDefaultJsConfig();

        // Only default exclude when no extends for now
        if (!configJson.extends) {
            configJson = Object.assign(
                {
                    exclude: getDefaultExclude()
                },
                configJson
            );
        }

        const extendedConfigPaths = new Set<string>();
        const { extendedConfigCache } = docContext;
        const cacheMonitorProxy = {
            ...docContext.extendedConfigCache,
            get(key: string) {
                extendedConfigPaths.add(key);
                return extendedConfigCache.get(key);
            },
            has(key: string) {
                extendedConfigPaths.add(key);
                return extendedConfigCache.has(key);
            },
            set(key: string, value: ts.ExtendedConfigCacheEntry) {
                extendedConfigPaths.add(key);
                return extendedConfigCache.set(key, value);
            }
        };

        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            tsSystem,
            workspacePath,
            forcedCompilerOptions,
            tsconfigPath,
            undefined,
            [
                {
                    extension: 'svelte',
                    isMixedContent: true,
                    // Deferred was added in a later TS version, fall back to tsx
                    // If Deferred exists, this means that all Svelte files are included
                    // in parsedConfig.fileNames
                    scriptKind: ts.ScriptKind.Deferred ?? ts.ScriptKind.TS
                }
            ],
            cacheMonitorProxy
        );

        const compilerOptions: ts.CompilerOptions = {
            ...parsedConfig.options,
            ...forcedCompilerOptions
        };
        if (
            !compilerOptions.moduleResolution ||
            compilerOptions.moduleResolution === ts.ModuleResolutionKind.Classic
        ) {
            compilerOptions.moduleResolution =
                // NodeJS: up to 4.9, Node10: since 5.0
                (ts.ModuleResolutionKind as any).NodeJs ?? ts.ModuleResolutionKind.Node10;
        }
        if (
            !compilerOptions.module ||
            [
                ts.ModuleKind.AMD,
                ts.ModuleKind.CommonJS,
                ts.ModuleKind.ES2015,
                ts.ModuleKind.None,
                ts.ModuleKind.System,
                ts.ModuleKind.UMD
            ].includes(compilerOptions.module)
        ) {
            compilerOptions.module = ts.ModuleKind.ESNext;
        }

        // detect which JSX namespace to use (svelte | svelteNative) if not specified or not compatible
        if (!compilerOptions.jsxFactory || !compilerOptions.jsxFactory.startsWith('svelte')) {
            //override if we detect svelte-native
            if (workspacePath) {
                try {
                    const svelteNativePkgInfo = getPackageInfo('svelte-native', workspacePath);
                    if (svelteNativePkgInfo.path) {
                        // For backwards compatibility
                        parsedConfig.raw.svelteOptions = parsedConfig.raw.svelteOptions || {};
                        parsedConfig.raw.svelteOptions.namespace = 'svelteNative.JSX';
                    }
                } catch (e) {
                    //we stay regular svelte
                }
            }
        }

        return {
            ...parsedConfig,
            fileNames: parsedConfig.fileNames.map(normalizePath),
            options: compilerOptions,
            extendedConfigPaths
        };
    }

    /**
     * This should only be used when there's no jsconfig/tsconfig at all
     */
    function getDefaultJsConfig(): {
        compilerOptions: ts.CompilerOptions;
        include: string[];
    } {
        return {
            compilerOptions: {
                maxNodeModuleJsDepth: 2,
                allowSyntheticDefaultImports: true
            },
            // Necessary to not flood the initial files
            // with potentially completely unrelated .ts/.js files:
            include: []
        };
    }

    function getDefaultExclude() {
        return ['node_modules', ...ignoredBuildDirectories];
    }

    /**
     * Disable usage of project files.
     * running language service in a reduced mode for
     * large projects with improperly excluded tsconfig.
     */
    function reduceLanguageServiceCapabilityIfFileSizeTooBig() {
        if (
            exceedsTotalSizeLimitForNonTsFiles(
                compilerOptions,
                tsconfigPath,
                snapshotManager,
                tsSystem
            )
        ) {
            languageService.cleanupSemanticCache();
            languageServiceReducedMode = true;
            if (project) {
                project.languageServiceEnabled = false;
            }
            docContext.notifyExceedSizeLimit?.();
        }
    }

    function dispose() {
        languageService.dispose();
        snapshotManager.dispose();
        configWatchers.get(tsconfigPath)?.close();
        configWatchers.delete(tsconfigPath);
        configFileForOpenFiles.clear();
        docContext.globalSnapshotsManager.removeChangeListener(scheduleUpdate);
    }

    function updateExtendedConfigDependents() {
        extendedConfigPaths.forEach((extendedConfig) => {
            let dependedTsConfig = extendedConfigToTsConfigPath.get(extendedConfig);
            if (!dependedTsConfig) {
                dependedTsConfig = new FileSet(tsSystem.useCaseSensitiveFileNames);
                extendedConfigToTsConfigPath.set(extendedConfig, dependedTsConfig);
            }

            dependedTsConfig.add(tsconfigPath);
        });
    }

    function watchConfigFile() {
        if (!tsSystem.watchFile || !docContext.watchTsConfig) {
            return;
        }

        if (!configWatchers.has(tsconfigPath) && tsconfigPath) {
            configFileModifiedTime.set(tsconfigPath, tsSystem.getModifiedTime?.(tsconfigPath));
            configWatchers.set(
                tsconfigPath,
                // for some reason setting the polling interval is necessary, else some error in TS is thrown
                tsSystem.watchFile(tsconfigPath, watchConfigCallback, 1000)
            );
        }

        for (const config of extendedConfigPaths) {
            if (extendedConfigWatchers.has(config)) {
                continue;
            }

            configFileModifiedTime.set(config, tsSystem.getModifiedTime?.(config));
            extendedConfigWatchers.set(
                config,
                // for some reason setting the polling interval is necessary, else some error in TS is thrown
                tsSystem.watchFile(config, createWatchExtendedConfigCallback(docContext), 1000)
            );
        }
    }

    async function watchConfigCallback(
        fileName: string,
        kind: ts.FileWatcherEventKind,
        modifiedTime: Date | undefined
    ) {
        if (
            kind === ts.FileWatcherEventKind.Changed &&
            !configFileModified(fileName, modifiedTime ?? tsSystem.getModifiedTime?.(fileName))
        ) {
            return;
        }

        dispose();

        if (kind === ts.FileWatcherEventKind.Changed) {
            scheduleReload(fileName);
        } else if (kind === ts.FileWatcherEventKind.Deleted) {
            services.delete(fileName);
            configFileForOpenFiles.clear();
        }

        docContext.onProjectReloaded?.();
    }

    function updateIfDirty() {
        if (!dirty) {
            return;
        }

        const oldProgram = project?.program;
        const program = languageService.getProgram();
        svelteModuleLoader.clearPendingInvalidations();

        if (project) {
            project.program = program;
        }

        dirty = false;

        if (!oldProgram) {
            changedFilesForExportCache.clear();
            return;
        }

        for (const fileName of changedFilesForExportCache) {
            const oldFile = oldProgram.getSourceFile(fileName);
            const newFile = program?.getSourceFile(fileName);

            // file for another tsconfig
            if (!oldFile && !newFile) {
                continue;
            }

            if (oldFile && newFile) {
                host.getCachedExportInfoMap?.().onFileChanged?.(oldFile, newFile, false);
            } else {
                // new file or deleted file
                host.getCachedExportInfoMap?.().clear();
            }
        }
        changedFilesForExportCache.clear();
    }

    function scheduleUpdate(triggeredFile?: string) {
        if (triggeredFile) {
            changedFilesForExportCache.add(triggeredFile);
        }
        if (dirty) {
            return;
        }

        projectVersion++;
        dirty = true;
    }

    function initLsCacheProject() {
        const projectService = docContext.projectService;
        if (!projectService) {
            return;
        }

        // Used by typescript-auto-import-cache to create a lean language service for package.json auto-import.
        const createLanguageServiceForAutoImportProvider = (host: ts.LanguageServiceHost) =>
            ts.createLanguageService(host, documentRegistry);

        return createProject(host, createLanguageServiceForAutoImportProvider, {
            compilerOptions: compilerOptions,
            projectService: projectService,
            currentDirectory: workspacePath
        });
    }

    function onAutoImportProviderSettingsChanged() {
        project?.onAutoImportProviderSettingsChanged();
    }

    function onPackageJsonChange(packageJsonPath: string) {
        if (!project) {
            return;
        }

        if (project.packageJsonsForAutoImport?.has(packageJsonPath)) {
            project.moduleSpecifierCache.clear();

            if (project.autoImportProviderHost) {
                project.autoImportProviderHost.markAsDirty();
            }
        }

        if (packageJsonPath.includes('node_modules')) {
            const dir = dirname(packageJsonPath);
            const inProgram = project
                .getCurrentProgram()
                ?.getSourceFiles()
                .some((file) => file.fileName.includes(dir));

            if (inProgram) {
                host.getModuleSpecifierCache?.().clear();
            }
        }
    }
}

/**
 * adopted from https://github.com/microsoft/TypeScript/blob/3c8e45b304b8572094c5d7fbb9cd768dbf6417c0/src/server/editorServices.ts#L1955
 */
function exceedsTotalSizeLimitForNonTsFiles(
    compilerOptions: ts.CompilerOptions,
    tsconfigPath: string,
    snapshotManager: SnapshotManager,
    tsSystem: ts.System
): boolean {
    if (compilerOptions.disableSizeLimit) {
        return false;
    }

    let availableSpace = maxProgramSizeForNonTsFiles;
    serviceSizeMap.set(tsconfigPath, 0);

    serviceSizeMap.forEach((size) => {
        availableSpace -= size;
    });

    let totalNonTsFileSize = 0;

    const fileNames = snapshotManager.getProjectFileNames();
    for (const fileName of fileNames) {
        if (hasTsExtensions(fileName)) {
            continue;
        }

        totalNonTsFileSize += tsSystem.getFileSize?.(fileName) ?? 0;

        if (totalNonTsFileSize > availableSpace) {
            const top5LargestFiles = fileNames
                .filter((name) => !hasTsExtensions(name))
                .map((name) => ({ name, size: tsSystem.getFileSize?.(name) ?? 0 }))
                .sort((a, b) => b.size - a.size)
                .slice(0, 5);

            Logger.log(
                `Non TS file size exceeded limit (${totalNonTsFileSize}). ` +
                    `Largest files: ${top5LargestFiles
                        .map((file) => `${file.name}:${file.size}`)
                        .join(', ')}`
            );

            return true;
        }
    }

    serviceSizeMap.set(tsconfigPath, totalNonTsFileSize);
    return false;
}

/**
 * shared watcher callback can't be within `createLanguageService`
 * because it would reference the closure
 * So that GC won't drop it and cause memory leaks
 */
function createWatchExtendedConfigCallback(docContext: LanguageServiceDocumentContext) {
    return async (
        fileName: string,
        kind: ts.FileWatcherEventKind,
        modifiedTime: Date | undefined
    ) => {
        if (
            kind === ts.FileWatcherEventKind.Changed &&
            !configFileModified(
                fileName,
                modifiedTime ?? docContext.tsSystem.getModifiedTime?.(fileName)
            )
        ) {
            return;
        }

        docContext.extendedConfigCache.delete(fileName);

        const promises = Array.from(extendedConfigToTsConfigPath.get(fileName) ?? []).map(
            async (config) => {
                const oldService = services.get(config);
                scheduleReload(config);
                (await oldService)?.dispose();
            }
        );

        await Promise.all(promises);
        docContext.onProjectReloaded?.();
    };
}

/**
 * check if file content is modified instead of attributes changed
 */
function configFileModified(fileName: string, modifiedTime: Date | undefined) {
    const previousModifiedTime = configFileModifiedTime.get(fileName);
    if (!modifiedTime || !previousModifiedTime) {
        return true;
    }

    if (previousModifiedTime >= modifiedTime) {
        return false;
    }

    configFileModifiedTime.set(fileName, modifiedTime);
    return true;
}

/**
 * schedule to the service reload to the next time the
 * service in requested
 * if there's still files opened it should be restarted
 * in the onProjectReloaded hooks
 */
function scheduleReload(fileName: string) {
    // don't delete service from map yet as it could result in a race condition
    // where a file update is received before the service is reloaded, swallowing the update
    pendingReloads.add(fileName);
}

function getOrCreateDocumentRegistry(
    currentDirectory: string,
    useCaseSensitiveFileNames: boolean
): ts.DocumentRegistry {
    // unless it's a multi root workspace, there's only one registry
    const key = [currentDirectory, useCaseSensitiveFileNames].join('|');

    let registry = documentRegistries.get(key);
    if (registry) {
        return registry;
    }

    registry = ts.createDocumentRegistry(useCaseSensitiveFileNames, currentDirectory);

    // impliedNodeFormat is always undefined when the svelte source file is created
    // We might patched it later but the registry doesn't know about it
    const releaseDocumentWithKey = registry.releaseDocumentWithKey;
    registry.releaseDocumentWithKey = (
        path: ts.Path,
        key: ts.DocumentRegistryBucketKey,
        scriptKind: ts.ScriptKind,
        impliedNodeFormat?: ts.ResolutionMode
    ) => {
        if (isSvelteFilePath(path)) {
            releaseDocumentWithKey(path, key, scriptKind, undefined);
            return;
        }

        releaseDocumentWithKey(path, key, scriptKind, impliedNodeFormat);
    };

    registry.releaseDocument = (
        fileName: string,
        compilationSettings: ts.CompilerOptions,
        scriptKind: ts.ScriptKind,
        impliedNodeFormat?: ts.ResolutionMode
    ) => {
        if (isSvelteFilePath(fileName)) {
            registry?.releaseDocument(fileName, compilationSettings, scriptKind, undefined);
            return;
        }

        registry?.releaseDocument(fileName, compilationSettings, scriptKind, impliedNodeFormat);
    };

    documentRegistries.set(key, registry);

    return registry;
}
