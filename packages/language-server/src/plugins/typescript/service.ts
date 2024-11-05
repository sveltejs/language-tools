import { dirname, join, resolve, basename } from 'path';
import ts from 'typescript';
import {
    DiagnosticSeverity,
    PublishDiagnosticsParams,
    RelativePattern,
    TextDocumentContentChangeEvent
} from 'vscode-languageserver-protocol';
import { getPackageInfo, importSvelte } from '../../importPackage';
import { Document } from '../../lib/documents';
import { configLoader } from '../../lib/documents/configLoader';
import { FileMap, FileSet } from '../../lib/documents/fileCollection';
import { Logger } from '../../logger';
import {
    createGetCanonicalFileName,
    isNotNullOrUndefined,
    normalizePath,
    pathToUrl,
    urlToPath
} from '../../utils';
import { DocumentSnapshot, SvelteSnapshotOptions } from './DocumentSnapshot';
import { createSvelteModuleLoader } from './module-loader';
import { GlobalSnapshotsManager, SnapshotManager } from './SnapshotManager';
import {
    ensureRealSvelteFilePath,
    findTsConfigPath,
    getNearestWorkspaceUri,
    hasTsExtensions,
    isSvelteFilePath
} from './utils';
import { createProject, ProjectService } from './serviceCache';
import { internalHelpers } from 'svelte2tsx';

export interface LanguageServiceContainer {
    readonly tsconfigPath: string;
    readonly compilerOptions: ts.CompilerOptions;
    readonly configErrors: ts.Diagnostic[];
    readonly snapshotManager: SnapshotManager;
    getService(skipSynchronize?: boolean): ts.LanguageService;
    updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot;
    deleteSnapshot(filePath: string): void;
    invalidateModuleCache(filePath: string[]): void;
    scheduleProjectFileUpdate(watcherNewFiles: string[]): void;
    ensureProjectFileUpdates(newFile?: string): void;
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
    getTsConfigSvelteOptions(): { namespace: string };
    getResolvedProjectReferences(): TsConfigInfo[];
    openVirtualDocument(document: Document): void;
    isShimFiles(filePath: string): boolean;
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

        /**
         * @internal
         */
        getModuleResolutionCache?(): ts.ModuleResolutionCache;
        /** @internal */
        setCompilerHost?(host: ts.CompilerHost): void;
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

export interface TsConfigInfo {
    parsedCommandLine: ts.ParsedCommandLine;
    snapshotManager: SnapshotManager;
    pendingProjectFileUpdate: boolean;
    configFilePath: string;
    extendedConfigPaths?: Set<string>;
}

enum TsconfigSvelteDiagnostics {
    NO_SVELTE_INPUT = 100_001
}

const maxProgramSizeForNonTsFiles = 20 * 1024 * 1024; // 20 MB
const services = new FileMap<Promise<LanguageServiceContainer>>();
const serviceSizeMap = new FileMap<number>();
const configWatchers = new FileMap<ts.FileWatcher>();
const dependedConfigWatchers = new FileMap<ts.FileWatcher>();
const configPathToDependedProject = new FileMap<FileSet>();
const configFileModifiedTime = new FileMap<Date | undefined>();
const configFileForOpenFiles = new FileMap<string>();
const pendingReloads = new FileSet();
const documentRegistries = new Map<string, ts.DocumentRegistry>();
const pendingForAllServices = new Set<Promise<void>>();
const parsedTsConfigInfo = new FileMap<TsConfigInfo | null>();

/**
 * For testing only: Reset the cache for services.
 * Try to refactor this some day so that this file provides
 * a setup function which creates all this nicely instead.
 */
export function __resetCache() {
    services.clear();
    parsedTsConfigInfo.clear();
    serviceSizeMap.clear();
    configFileForOpenFiles.clear();
}

export interface LanguageServiceDocumentContext {
    isSvelteCheck: boolean;
    ambientTypesSource: string;
    transformOnTemplateError: boolean;
    createDocument: (fileName: string, content: string) => Document;
    globalSnapshotsManager: GlobalSnapshotsManager;
    notifyExceedSizeLimit: (() => void) | undefined;
    extendedConfigCache: Map<string, ts.ExtendedConfigCacheEntry>;
    onProjectReloaded: ((configFileNames: string[]) => void) | undefined;
    reportConfigError: ((diagnostics: PublishDiagnosticsParams) => void) | undefined;
    watchTsConfig: boolean;
    tsSystem: ts.System;
    projectService: ProjectService | undefined;
    watchDirectory: ((patterns: RelativePattern[]) => void) | undefined;
    nonRecursiveWatchPattern: string | undefined;
}

export async function getService(
    path: string,
    workspaceUris: string[],
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const getCanonicalFileName = createGetCanonicalFileName(
        docContext.tsSystem.useCaseSensitiveFileNames
    );

    const fileExistsWithCache = (fileName: string) => {
        return (
            (parsedTsConfigInfo.has(fileName) && !pendingReloads.has(fileName)) ||
            docContext.tsSystem.fileExists(fileName)
        );
    };

    let tsconfigPath =
        configFileForOpenFiles.get(path) ??
        findTsConfigPath(path, workspaceUris, fileExistsWithCache, getCanonicalFileName);

    if (tsconfigPath) {
        /**
         * Prevent infinite loop when the project reference is circular
         */
        const triedTsConfig = new Set<string>();
        const needAssign = !configFileForOpenFiles.has(path);
        let service = await getConfiguredService(tsconfigPath);
        if (!needAssign) {
            return service;
        }

        // First try to find a service whose includes config matches our file
        const defaultService = await findDefaultServiceForFile(service, triedTsConfig);
        if (defaultService) {
            configFileForOpenFiles.set(path, defaultService.tsconfigPath);
            return defaultService;
        }

        // If no such service found, see if the file is part of any existing service indirectly.
        // This can happen if the includes doesn't match the file but it was imported from one of the included files.
        for (const configPath of triedTsConfig) {
            const service = await getConfiguredService(configPath);
            const ls = service.getService();
            if (ls.getProgram()?.getSourceFile(path)) {
                return service;
            }
        }

        tsconfigPath = '';
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

    function getConfiguredService(tsconfigPath: string) {
        return getServiceForTsconfig(tsconfigPath, dirname(tsconfigPath), docContext);
    }

    async function findDefaultServiceForFile(
        service: LanguageServiceContainer,
        triedTsConfig: Set<string>
    ): Promise<LanguageServiceContainer | undefined> {
        service.ensureProjectFileUpdates(path);
        if (service.snapshotManager.isProjectFile(path)) {
            return service;
        }
        if (triedTsConfig.has(service.tsconfigPath)) {
            return;
        }

        triedTsConfig.add(service.tsconfigPath);

        // TODO: maybe add support for ts 5.6's ancestor searching
        return findDefaultFromProjectReferences(service, triedTsConfig);
    }

    async function findDefaultFromProjectReferences(
        service: LanguageServiceContainer,
        triedTsConfig: Set<string>
    ) {
        const projectReferences = service.getResolvedProjectReferences();
        if (projectReferences.length === 0) {
            return undefined;
        }

        let possibleSubPaths: string[] = [];
        for (const ref of projectReferences) {
            if (ref.snapshotManager.isProjectFile(path)) {
                return getConfiguredService(ref.configFilePath);
            }

            if (ref.parsedCommandLine.projectReferences?.length) {
                possibleSubPaths.push(ref.configFilePath);
            }
        }

        for (const ref of possibleSubPaths) {
            const subService = await getConfiguredService(ref);
            const defaultService = await findDefaultServiceForFile(subService, triedTsConfig);
            if (defaultService) {
                return defaultService;
            }
        }
    }
}

export async function forAllServices(
    cb: (service: LanguageServiceContainer) => any
): Promise<void> {
    const promise = forAllServicesWorker(cb);
    pendingForAllServices.add(promise);
    await promise;
    pendingForAllServices.delete(promise);
}

async function forAllServicesWorker(cb: (service: LanguageServiceContainer) => any): Promise<void> {
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
    if (tsconfigPath) {
        tsconfigPath = normalizePath(tsconfigPath);
    }
    const tsconfigPathOrWorkspacePath = tsconfigPath || workspacePath;
    const reloading = pendingReloads.has(tsconfigPath);

    let service: LanguageServiceContainer;

    if (reloading || !services.has(tsconfigPathOrWorkspacePath)) {
        if (reloading) {
            Logger.log('Reloading ts service at ', tsconfigPath, ' due to config updated');
            parsedTsConfigInfo.delete(tsconfigPath);
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

    if (pendingForAllServices.size > 0) {
        await Promise.all(pendingForAllServices);
    }

    return service;
}

async function createLanguageService(
    tsconfigPath: string,
    workspacePath: string,
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const { tsSystem } = docContext;

    const projectConfig = getParsedConfig();
    const { options: compilerOptions, raw, errors: configErrors } = projectConfig;
    const allowJs = compilerOptions.allowJs ?? !!compilerOptions.checkJs;
    const virtualDocuments = new FileMap<Document>(tsSystem.useCaseSensitiveFileNames);

    const getCanonicalFileName = createGetCanonicalFileName(tsSystem.useCaseSensitiveFileNames);
    watchWildCardDirectories(projectConfig);

    const snapshotManager = createSnapshotManager(projectConfig, tsconfigPath);

    // Load all configs within the tsconfig scope and the one above so that they are all loaded
    // by the time they need to be accessed synchronously by DocumentSnapshots.
    await configLoader.loadConfigs(workspacePath);

    const svelteModuleLoader = createSvelteModuleLoader(
        getSnapshot,
        compilerOptions,
        tsSystem,
        ts,
        () => host?.getCompilerHost?.()
    );

    let svelteTsPath: string;
    /**
     * set and clear during program creation, shouldn't not be cached elsewhere
     */
    let compilerHost: ts.CompilerHost | undefined;
    try {
        // For when svelte2tsx/svelte-check is part of node_modules, for example VS Code extension
        svelteTsPath = dirname(require.resolve(docContext.ambientTypesSource));
    } catch (e) {
        // Fall back to dirname
        svelteTsPath = __dirname;
    }
    const sveltePackageInfo = getPackageInfo('svelte', tsconfigPath || workspacePath);
    // Svelte 4 has some fixes with regards to parsing the generics attribute.
    // Svelte 5 has new features, but we don't want to add the new compiler into language-tools. In the future it's probably
    // best to shift more and more of this into user's node_modules for better handling of multiple Svelte versions.
    const svelteCompiler =
        sveltePackageInfo.version.major >= 4
            ? importSvelte(tsconfigPath || workspacePath)
            : undefined;

    const changedFilesForExportCache = new Set<string>();
    const svelteTsxFiles = getSvelteShimFiles();

    let languageServiceReducedMode = false;
    let projectVersion = 0;
    let dirty = projectConfig.fileNames.length > 0;
    let skipSvelteInputCheck = !tsconfigPath;

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
        realpath: tsSystem.realpath,
        getDirectories: tsSystem.getDirectories,
        getProjectReferences: () => projectConfig.projectReferences,
        getParsedCommandLine,
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
        setCompilerHost: (host) => (compilerHost = host),
        getCompilerHost: () => compilerHost
    };

    const documentRegistry = getOrCreateDocumentRegistry(
        // this should mostly be a singleton while host.getCurrentDirectory() might be the directory where the tsconfig is
        tsSystem.getCurrentDirectory(),
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
    watchConfigFiles(projectConfig.extendedConfigPaths, projectConfig);

    return {
        tsconfigPath,
        compilerOptions,
        configErrors,
        getService,
        updateSnapshot,
        deleteSnapshot,
        scheduleProjectFileUpdate,
        updateTsOrJsFile,
        ensureProjectFileUpdates,
        hasFile,
        fileBelongsToProject,
        snapshotManager,
        invalidateModuleCache,
        onAutoImportProviderSettingsChanged,
        onPackageJsonChange,
        getTsConfigSvelteOptions,
        getResolvedProjectReferences,
        openVirtualDocument,
        isShimFiles,
        dispose
    };

    function createSnapshotManager(
        parsedCommandLine: ts.ParsedCommandLine,
        configFileName: string
    ) {
        const cached = configFileName ? parsedTsConfigInfo.get(configFileName) : undefined;
        if (cached?.snapshotManager) {
            return cached.snapshotManager;
        }
        // raw is the tsconfig merged with extending config
        // see: https://github.com/microsoft/TypeScript/blob/08e4f369fbb2a5f0c30dee973618d65e6f7f09f8/src/compiler/commandLineParser.ts#L2537
        return new SnapshotManager(
            docContext.globalSnapshotsManager,
            parsedCommandLine.raw,
            configFileName ? dirname(configFileName) : workspacePath,
            tsSystem,
            parsedCommandLine.fileNames.map(normalizePath),
            parsedCommandLine.wildcardDirectories
        );
    }

    function watchWildCardDirectories(parseCommandLine: ts.ParsedCommandLine) {
        const { wildcardDirectories } = parseCommandLine;
        if (!wildcardDirectories || !docContext.watchDirectory) {
            return;
        }

        const canonicalWorkspacePath = getCanonicalFileName(workspacePath);
        const patterns: RelativePattern[] = [];

        Object.entries(wildcardDirectories).forEach(([dir, flags]) => {
            if (
                // already watched
                getCanonicalFileName(dir).startsWith(canonicalWorkspacePath) ||
                !tsSystem.directoryExists(dir)
            ) {
                return;
            }
            patterns.push({
                baseUri: pathToUrl(dir),
                pattern:
                    (flags & ts.WatchDirectoryFlags.Recursive ? `**/` : '') +
                    docContext.nonRecursiveWatchPattern
            });
        });

        docContext.watchDirectory?.(patterns);
    }

    function getService(skipSynchronize?: boolean) {
        ensureProjectFileUpdates();

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

    function invalidateModuleCache(filePaths: string[]) {
        for (const filePath of filePaths) {
            svelteModuleLoader.deleteFromModuleCache(filePath);
            svelteModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);

            scheduleUpdate(filePath);
        }
    }

    function updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot {
        return typeof documentOrFilePath === 'string'
            ? updateSnapshotFromFilePath(documentOrFilePath)
            : updateSnapshotFromDocument(documentOrFilePath);
    }

    function updateSnapshotFromDocument(document: Document): DocumentSnapshot {
        const filePath = document.getFilePath() || '';
        const prevSnapshot = snapshotManager.get(filePath);

        if (
            prevSnapshot?.version === document.version &&
            // In the test, there might be a new document instance with a different openedByClient
            // In that case, Create a new snapshot otherwise the getClientFileNames won't include the new client file
            prevSnapshot.isOpenedInClient() === document.openedByClient
        ) {
            return prevSnapshot;
        }

        const newSnapshot = DocumentSnapshot.fromDocument(document, transformationConfig);

        if (!prevSnapshot) {
            svelteModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
            if (configFileForOpenFiles.get(filePath) === '' && services.size > 1) {
                configFileForOpenFiles.delete(filePath);
            }
        } else if (prevSnapshot.scriptKind !== newSnapshot.scriptKind && !allowJs) {
            // if allowJs is false, we need to invalid the cache so that js svelte files can be loaded through module resolution
            svelteModuleLoader.deleteFromModuleCache(filePath);
            configFileForOpenFiles.delete(filePath);
        }

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

    function scheduleProjectFileUpdate(watcherNewFiles: string[]): void {
        if (!snapshotManager.areIgnoredFromNewFileWatch(watcherNewFiles)) {
            scheduleUpdate();
            const info = parsedTsConfigInfo.get(tsconfigPath);
            if (info) {
                info.pendingProjectFileUpdate = true;
            }
        }

        if (!projectConfig.projectReferences) {
            return;
        }
        for (const ref of projectConfig.projectReferences) {
            const config = parsedTsConfigInfo.get(ref.path);
            if (
                config &&
                // handled by the respective service
                !services.has(config.configFilePath) &&
                !config.snapshotManager.areIgnoredFromNewFileWatch(watcherNewFiles)
            ) {
                config.pendingProjectFileUpdate = true;
                scheduleUpdate();
            }
        }
    }

    function ensureProjectFileUpdates(newFile?: string): void {
        const info = parsedTsConfigInfo.get(tsconfigPath);
        if (!info) {
            return;
        }

        if (
            newFile &&
            !info.pendingProjectFileUpdate &&
            // no global snapshots yet when initial load pending
            !snapshotManager.isProjectFile(newFile) &&
            !docContext.globalSnapshotsManager.get(newFile)
        ) {
            scheduleProjectFileUpdate([newFile]);
        }

        if (!info.pendingProjectFileUpdate) {
            return;
        }
        const projectFileCountBefore = snapshotManager.getProjectFileNames().length;
        ensureFilesForConfigUpdates(info);
        const projectFileCountAfter = snapshotManager.getProjectFileNames().length;

        if (projectFileCountAfter > projectFileCountBefore) {
            reduceLanguageServiceCapabilityIfFileSizeTooBig();
        }
    }

    function getScriptFileNames() {
        const projectFiles = languageServiceReducedMode
            ? []
            : snapshotManager.getProjectFileNames();
        const canonicalProjectFileNames = new Set(projectFiles.map(getCanonicalFileName));

        // We only assign project files (i.e. those found through includes config) and virtual files to getScriptFileNames.
        // We don't to include other client files otherwise they stay in the program and are never removed
        const clientFiles = tsconfigPath
            ? Array.from(virtualDocuments.values())
                  .map((v) => v.getFilePath())
                  .filter(isNotNullOrUndefined)
            : snapshotManager.getClientFileNames();

        return Array.from(
            new Set([
                ...projectFiles,
                // project file is read from the file system so it's more likely to have
                // the correct casing
                ...clientFiles.filter(
                    (file) => !canonicalProjectFileNames.has(getCanonicalFileName(file))
                ),
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
        let compilerOptions: ts.CompilerOptions;
        let parsedConfig: ts.ParsedCommandLine;
        let extendedConfigPaths: Set<string> | undefined;

        if (tsconfigPath) {
            const info = ensureTsConfigInfoUpToDate(tsconfigPath);
            // tsconfig is either found from file-system or passed from svelte-check
            // so this is already be validated to exist
            if (!info) {
                throw new Error('Failed to get tsconfig: ' + tsconfigPath);
            }
            compilerOptions = info.parsedCommandLine.options;
            parsedConfig = info.parsedCommandLine;
            extendedConfigPaths = info.extendedConfigPaths;
        } else {
            const config = parseDefaultCompilerOptions();
            compilerOptions = config.compilerOptions;
            parsedConfig = config.parsedConfig;
        }

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

        if (!compilerOptions.target) {
            compilerOptions.target = ts.ScriptTarget.Latest;
        } else if (ts.ScriptTarget.ES2015 > compilerOptions.target) {
            compilerOptions.target = ts.ScriptTarget.ES2015;
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

    function checkSvelteInput(program: ts.Program | undefined, config: ts.ParsedCommandLine) {
        if (!tsconfigPath || config.raw.references || config.raw.files) {
            return [];
        }

        const configFileName = basename(tsconfigPath);
        // Only report to possible nearest config file since referenced project might not be a svelte project
        if (configFileName !== 'tsconfig.json' && configFileName !== 'jsconfig.json') {
            return [];
        }

        const hasSvelteFiles =
            config.fileNames.some(isSvelteFilePath) ||
            program?.getSourceFiles().some((file) => isSvelteFilePath(file.fileName));

        if (hasSvelteFiles) {
            return [];
        }

        const { include, exclude } = config.raw;
        const inputText = JSON.stringify(include);
        const excludeText = JSON.stringify(exclude);
        const svelteConfigDiagnostics: ts.Diagnostic[] = [
            {
                category: ts.DiagnosticCategory.Warning,
                code: TsconfigSvelteDiagnostics.NO_SVELTE_INPUT,
                file: undefined,
                start: undefined,
                length: undefined,
                messageText:
                    `No svelte input files were found in config file '${tsconfigPath}'. ` +
                    `Did you forget to add svelte files to the 'include' in your ${basename(tsconfigPath)}? ` +
                    `Specified 'include' paths were '${inputText}' and 'exclude' paths were '${excludeText}'`,
                source: 'svelte'
            }
        ];

        return svelteConfigDiagnostics;
    }

    function parseDefaultCompilerOptions() {
        let configJson = {
            compilerOptions: {
                allowJs: true,
                noEmit: true,
                declaration: false,
                skipLibCheck: true,
                maxNodeModuleJsDepth: 2,
                allowSyntheticDefaultImports: true
            },
            // Necessary to not flood the initial files
            // with potentially completely unrelated .ts/.js files:
            include: []
        };

        const parsedConfig = ts.parseJsonConfigFileContent(configJson, tsSystem, workspacePath);

        const compilerOptions: ts.CompilerOptions = {
            ...parsedConfig.options,
            target: ts.ScriptTarget.Latest,
            allowNonTsExtensions: true,
            moduleResolution: ts.ModuleResolutionKind.Node10
        };

        return { compilerOptions, parsedConfig };
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
        compilerHost = undefined;
        languageService.dispose();
        snapshotManager.dispose();
        configWatchers.get(tsconfigPath)?.close();
        configWatchers.delete(tsconfigPath);
        configFileForOpenFiles.clear();
        docContext.globalSnapshotsManager.removeChangeListener(scheduleUpdate);
    }

    function watchConfigFiles(
        extendedConfigPaths: Set<string> | undefined,
        parsedCommandLine: ts.ParsedCommandLine
    ) {
        const tsconfigDependencies = Array.from(extendedConfigPaths ?? []).concat(
            parsedCommandLine.projectReferences?.map((r) => r.path) ?? []
        );
        tsconfigDependencies.forEach((configPath) => {
            let dependedTsConfig = configPathToDependedProject.get(configPath);
            if (!dependedTsConfig) {
                dependedTsConfig = new FileSet(tsSystem.useCaseSensitiveFileNames);
                configPathToDependedProject.set(configPath, dependedTsConfig);
            }

            dependedTsConfig.add(tsconfigPath);
        });

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

        for (const config of tsconfigDependencies) {
            if (dependedConfigWatchers.has(config)) {
                continue;
            }

            configFileModifiedTime.set(config, tsSystem.getModifiedTime?.(config));
            dependedConfigWatchers.set(
                config,
                // for some reason setting the polling interval is necessary, else some error in TS is thrown
                tsSystem.watchFile(config, createWatchDependedConfigCallback(docContext), 1000)
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

        docContext.onProjectReloaded?.([fileName]);
        docContext.reportConfigError?.({ uri: pathToUrl(fileName), diagnostics: [] });
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
        compilerHost = undefined;

        if (!skipSvelteInputCheck) {
            const svelteConfigDiagnostics = checkSvelteInput(program, projectConfig);
            const codes = svelteConfigDiagnostics.map((d) => d.code);
            if (!svelteConfigDiagnostics.length) {
                // stop checking once it passed once
                skipSvelteInputCheck = true;
            }
            // report even if empty to clear previous diagnostics
            docContext.reportConfigError?.({
                uri: pathToUrl(tsconfigPath),
                diagnostics: svelteConfigDiagnostics.map((d) => ({
                    message: d.messageText as string,
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    severity: DiagnosticSeverity.Warning,
                    source: 'svelte'
                }))
            });
            const new_errors = projectConfig.errors
                .filter((e) => !codes.includes(e.code))
                .concat(svelteConfigDiagnostics);
            projectConfig.errors.splice(0, projectConfig.errors.length, ...new_errors);
        }

        // https://github.com/microsoft/TypeScript/blob/23faef92703556567ddbcb9afb893f4ba638fc20/src/server/project.ts#L1624
        // host.getCachedExportInfoMap will create the cache if it doesn't exist
        // so we need to check the property instead
        const exportMapCache = project?.exportMapCache;
        if (!oldProgram || !exportMapCache || exportMapCache.isEmpty()) {
            changedFilesForExportCache.clear();
            return;
        }

        exportMapCache.releaseSymbols();
        // https://github.com/microsoft/TypeScript/blob/941d1543c201e40d87e63c9db04818493afdd9e7/src/server/project.ts#L1731
        // if one file change results in clearing the cache
        // don't continue to check other files, this will mark the cache as usable while it's empty
        for (const fileName of changedFilesForExportCache) {
            const oldFile = oldProgram.getSourceFile(fileName);
            const newFile = program?.getSourceFile(fileName);

            // file for another tsconfig
            if (!oldFile && !newFile) {
                continue;
            }

            if (!oldFile || !newFile) {
                // new file or deleted file
                exportMapCache.clear();
                break;
            }

            const cleared = exportMapCache.onFileChanged?.(oldFile, newFile, false);
            if (cleared) {
                break;
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

    function getTsConfigSvelteOptions() {
        // if there's more options in the future, get it from raw.svelteOptions and normalize it
        return {
            namespace: transformationConfig.typingsNamespace
        };
    }

    function ensureTsConfigInfoUpToDate(configFilePath: string) {
        const cached = parsedTsConfigInfo.get(configFilePath);
        if (cached !== undefined) {
            ensureFilesForConfigUpdates(cached);
            return cached;
        }

        const content = tsSystem.fileExists(configFilePath) && tsSystem.readFile(configFilePath);
        if (!content) {
            parsedTsConfigInfo.set(configFilePath, null);
            return null;
        }

        const json = ts.parseJsonText(configFilePath, content);

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

        // TypeScript will throw if the parsedCommandLine doesn't include the sourceFile for the config file
        // i.e. it must be directly parse from the json text instead of a javascript object like we do in getParsedConfig
        const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(
            json,
            tsSystem,
            dirname(configFilePath),
            /*existingOptions*/ undefined,
            configFilePath,
            /*resolutionStack*/ undefined,
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

        parsedCommandLine.options.allowNonTsExtensions = true;

        const snapshotManager = createSnapshotManager(parsedCommandLine, configFilePath);

        const tsconfigInfo: TsConfigInfo = {
            parsedCommandLine,
            snapshotManager,
            pendingProjectFileUpdate: false,
            configFilePath,
            extendedConfigPaths
        };
        parsedTsConfigInfo.set(configFilePath, tsconfigInfo);

        watchConfigFiles(extendedConfigPaths, parsedCommandLine);

        return tsconfigInfo;
    }

    function getParsedCommandLine(configFilePath: string) {
        return ensureTsConfigInfoUpToDate(configFilePath)?.parsedCommandLine;
    }

    function ensureFilesForConfigUpdates(info: TsConfigInfo | null) {
        if (info?.pendingProjectFileUpdate) {
            info.pendingProjectFileUpdate = false;
            info.snapshotManager.updateProjectFiles();
            info.parsedCommandLine.fileNames = info.snapshotManager.getProjectFileNames();
        }
    }

    function getResolvedProjectReferences(): TsConfigInfo[] {
        if (!tsconfigPath || !projectConfig.projectReferences) {
            return [];
        }

        return projectConfig.projectReferences
            .map((ref) => ensureTsConfigInfoUpToDate(normalizePath(ref.path)))
            .filter(isNotNullOrUndefined);
    }

    function openVirtualDocument(document: Document) {
        const filePath = document.getFilePath();
        if (!filePath) {
            return;
        }
        virtualDocuments.set(filePath, document);
        configFileForOpenFiles.set(filePath, tsconfigPath || workspacePath);
        updateSnapshot(document);
        scheduleUpdate(filePath);
    }

    function getSvelteShimFiles() {
        const svelteTsxFiles = internalHelpers.get_global_types(
            tsSystem,
            sveltePackageInfo.version.major === 3,
            sveltePackageInfo.path,
            svelteTsPath,
            docContext.isSvelteCheck ? undefined : tsconfigPath || workspacePath
        );
        const result = new FileSet(tsSystem.useCaseSensitiveFileNames);

        svelteTsxFiles.forEach((f) => result.add(normalizePath(f)));
        return result;
    }

    function isShimFiles(filePath: string) {
        return svelteTsxFiles.has(normalizePath(filePath));
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
function createWatchDependedConfigCallback(docContext: LanguageServiceDocumentContext) {
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

        const getCanonicalFileName = createGetCanonicalFileName(
            docContext.tsSystem.useCaseSensitiveFileNames
        );

        docContext.extendedConfigCache.delete(getCanonicalFileName(fileName));
        // rely on TypeScript internal behavior so delete both just in case
        docContext.extendedConfigCache.delete(fileName);

        const reloadingConfigs: string[] = [];
        const promises = Array.from(configPathToDependedProject.get(fileName) ?? []).map(
            async (config) => {
                reloadingConfigs.push(config);
                const oldService = services.get(config);
                scheduleReload(config);
                (await oldService)?.dispose();
            }
        );

        await Promise.all(promises);
        docContext.onProjectReloaded?.(reloadingConfigs);
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
