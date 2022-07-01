import { dirname, resolve } from 'path';
import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';
import { getPackageInfo } from '../../importPackage';
import { Document } from '../../lib/documents';
import { configLoader } from '../../lib/documents/configLoader';
import { Logger } from '../../logger';
import { normalizePath, urlToPath } from '../../utils';
import { DocumentSnapshot, SvelteSnapshotOptions } from './DocumentSnapshot';
import { createSvelteModuleLoader } from './module-loader';
import {
    GlobalSnapshotsManager,
    ignoredBuildDirectories,
    SnapshotManager
} from './SnapshotManager';
import { ensureRealSvelteFilePath, findTsConfigPath, hasTsExtensions, isSubPath } from './utils';

export interface LanguageServiceContainer {
    readonly tsconfigPath: string;
    readonly compilerOptions: ts.CompilerOptions;
    /**
     * @internal Public for tests only
     */
    readonly snapshotManager: SnapshotManager;
    getService(): ts.LanguageService;
    updateSnapshot(documentOrFilePath: Document | string): DocumentSnapshot;
    deleteSnapshot(filePath: string): void;
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
    fileBelongsToProject(filePath: string): boolean;

    dispose(): void;
}

const maxProgramSizeForNonTsFiles = 20 * 1024 * 1024; // 20 MB
const services = new Map<string, Promise<LanguageServiceContainer>>();
const serviceSizeMap = new Map<string, number>();
const configWatchers = new Map<string, ts.FileWatcher>();
const extendedConfigWatchers = new Map<string, ts.FileWatcher>();
const extendedConfigToTsConfigPath = new Map<string, Set<string>>();
const pendingReloads = new Set<string>();

/**
 * For testing only: Reset the cache for services.
 * Try to refactor this some day so that this file provides
 * a setup function which creates all this nicely instead.
 */
export function __resetCache() {
    services.clear();
    serviceSizeMap.clear();
}

export interface LanguageServiceDocumentContext {
    ambientTypesSource: string;
    transformOnTemplateError: boolean;
    useNewTransformation: boolean;
    createDocument: (fileName: string, content: string) => Document;
    globalSnapshotsManager: GlobalSnapshotsManager;
    notifyExceedSizeLimit: (() => void) | undefined;
    extendedConfigCache: Map<string, ts.ExtendedConfigCacheEntry>;
    onProjectReloaded: (() => void) | undefined;
    watchTsConfig: boolean;
    tsSystem: ts.System;
}

export async function getService(
    path: string,
    workspaceUris: string[],
    docContext: LanguageServiceDocumentContext
): Promise<LanguageServiceContainer> {
    const tsconfigPath = findTsConfigPath(path, workspaceUris, docContext.tsSystem.fileExists);

    if (tsconfigPath) {
        return getServiceForTsconfig(tsconfigPath, dirname(tsconfigPath), docContext);
    }

    const nearestWorkspaceUri = workspaceUris.find((workspaceUri) => isSubPath(workspaceUri, path));

    return getServiceForTsconfig(
        tsconfigPath,
        (nearestWorkspaceUri && urlToPath(nearestWorkspaceUri)) ?? ts.sys.getCurrentDirectory(),
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

    let service: LanguageServiceContainer;
    if (services.has(tsconfigPathOrWorkspacePath)) {
        service = await services.get(tsconfigPathOrWorkspacePath)!;
    } else {
        const reloading = pendingReloads.has(tsconfigPath);

        if (reloading) {
            Logger.log('Reloading ts service at ', tsconfigPath, ' due to config updated');
        } else {
            Logger.log('Initialize new ts service at ', tsconfigPath);
        }

        pendingReloads.delete(tsconfigPath);
        const newService = createLanguageService(tsconfigPath, workspacePath, docContext);
        services.set(tsconfigPathOrWorkspacePath, newService);
        service = await newService;
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
        fileNames: files,
        raw,
        extendedConfigPaths
    } = getParsedConfig();
    // raw is the tsconfig merged with extending config
    // see: https://github.com/microsoft/TypeScript/blob/08e4f369fbb2a5f0c30dee973618d65e6f7f09f8/src/compiler/commandLineParser.ts#L2537
    const snapshotManager = new SnapshotManager(
        docContext.globalSnapshotsManager,
        files,
        raw,
        workspacePath
    );

    // Load all configs within the tsconfig scope and the one above so that they are all loaded
    // by the time they need to be accessed synchronously by DocumentSnapshots to determine
    // the default language.
    await configLoader.loadConfigs(workspacePath);

    const svelteModuleLoader = createSvelteModuleLoader(getSnapshot, compilerOptions, tsSystem);

    let svelteTsPath: string;
    try {
        // For when svelte2tsx/svelte-check is part of node_modules, for example VS Code extension
        svelteTsPath = dirname(require.resolve(docContext.ambientTypesSource));
    } catch (e) {
        // Fall back to dirname
        svelteTsPath = __dirname;
    }
    const svelteTsxFiles = [
        './svelte-shims.d.ts',
        './svelte-jsx.d.ts',
        './svelte-native-jsx.d.ts'
    ].map((f) => tsSystem.resolvePath(resolve(svelteTsPath, f)));

    let languageServiceReducedMode = false;
    let projectVersion = 0;

    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () =>
            Array.from(
                new Set([
                    ...(languageServiceReducedMode ? [] : snapshotManager.getProjectFileNames()),
                    ...snapshotManager.getFileNames(),
                    ...svelteTsxFiles
                ])
            ),
        getScriptVersion: (fileName: string) => getSnapshot(fileName).version.toString(),
        getScriptSnapshot: getSnapshot,
        getCurrentDirectory: () => workspacePath,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        fileExists: svelteModuleLoader.fileExists,
        readFile: svelteModuleLoader.readFile,
        resolveModuleNames: svelteModuleLoader.resolveModuleNames,
        readDirectory: svelteModuleLoader.readDirectory,
        getDirectories: tsSystem.getDirectories,
        useCaseSensitiveFileNames: () => tsSystem.useCaseSensitiveFileNames,
        getScriptKind: (fileName: string) => getSnapshot(fileName).scriptKind,
        getProjectVersion: () => projectVersion.toString(),
        getNewLine: () => tsSystem.newLine
    };

    let languageService = ts.createLanguageService(host);
    const transformationConfig: SvelteSnapshotOptions = {
        transformOnTemplateError: docContext.transformOnTemplateError,
        useNewTransformation: docContext.useNewTransformation,
        typingsNamespace: raw?.svelteOptions?.namespace || 'svelteHTML'
    };

    const onSnapshotChange = () => {
        projectVersion++;
    };
    docContext.globalSnapshotsManager.onChange(onSnapshotChange);

    reduceLanguageServiceCapabilityIfFileSizeTooBig();
    updateExtendedConfigDependents();
    watchConfigFile();

    return {
        tsconfigPath,
        compilerOptions,
        getService: () => languageService,
        updateSnapshot,
        deleteSnapshot,
        updateProjectFiles,
        updateTsOrJsFile,
        hasFile,
        fileBelongsToProject,
        snapshotManager,
        dispose
    };

    function deleteSnapshot(filePath: string): void {
        svelteModuleLoader.deleteFromModuleCache(filePath);
        snapshotManager.delete(filePath);
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
        if (prevSnapshot && prevSnapshot.scriptKind !== newSnapshot.scriptKind) {
            // Restart language service as it doesn't handle script kind changes.
            languageService.dispose();
            languageService = ts.createLanguageService(host);
        }

        return newSnapshot;
    }

    function updateSnapshotFromFilePath(filePath: string): DocumentSnapshot {
        const prevSnapshot = snapshotManager.get(filePath);
        if (prevSnapshot) {
            return prevSnapshot;
        }

        svelteModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
        const newSnapshot = DocumentSnapshot.fromFilePath(
            filePath,
            docContext.createDocument,
            transformationConfig,
            tsSystem
        );
        snapshotManager.set(filePath, newSnapshot);
        return newSnapshot;
    }

    function getSnapshot(fileName: string): DocumentSnapshot {
        fileName = ensureRealSvelteFilePath(fileName);

        let doc = snapshotManager.get(fileName);
        if (doc) {
            return doc;
        }

        svelteModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
        doc = DocumentSnapshot.fromFilePath(
            fileName,
            docContext.createDocument,
            transformationConfig,
            tsSystem
        );
        snapshotManager.set(fileName, doc);
        return doc;
    }

    function updateProjectFiles(): void {
        projectVersion++;
        const projectFileCountBefore = snapshotManager.getProjectFileNames().length;
        snapshotManager.updateProjectFiles();
        const projectFileCountAfter = snapshotManager.getProjectFileNames().length;

        if (projectFileCountAfter <= projectFileCountBefore) {
            return;
        }

        reduceLanguageServiceCapabilityIfFileSizeTooBig();
    }

    function hasFile(filePath: string): boolean {
        return snapshotManager.has(filePath);
    }

    function fileBelongsToProject(filePath: string): boolean {
        filePath = normalizePath(filePath);
        return hasFile(filePath) || getParsedConfig().fileNames.includes(filePath);
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
        if (!docContext.useNewTransformation) {
            // these are needed to handle the results of svelte2tsx preprocessing:
            forcedCompilerOptions.jsx = ts.JsxEmit.Preserve;
        }

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
                    scriptKind:
                        ts.ScriptKind.Deferred ??
                        (docContext.useNewTransformation ? ts.ScriptKind.TS : ts.ScriptKind.TSX)
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
            compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
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
            if (!docContext.useNewTransformation) {
                //default to regular svelte, this causes the usage of the "svelte.JSX" namespace
                compilerOptions.jsxFactory = 'svelte.createElement';
            }

            //override if we detect svelte-native
            if (workspacePath) {
                try {
                    const svelteNativePkgInfo = getPackageInfo('svelte-native', workspacePath);
                    if (svelteNativePkgInfo.path) {
                        if (docContext.useNewTransformation) {
                            // For backwards compatibility
                            parsedConfig.raw.svelteOptions = parsedConfig.raw.svelteOptions || {};
                            parsedConfig.raw.svelteOptions.namespace = 'svelteNative.JSX';
                        } else {
                            compilerOptions.jsxFactory = 'svelteNative.createElement';
                        }
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
            docContext.notifyExceedSizeLimit?.();
        }
    }

    function dispose() {
        languageService.dispose();
        snapshotManager.dispose();
        configWatchers.get(tsconfigPath)?.close();
        configWatchers.delete(tsconfigPath);
        docContext.globalSnapshotsManager.removeChangeListener(onSnapshotChange);
    }

    function updateExtendedConfigDependents() {
        extendedConfigPaths.forEach((extendedConfig) => {
            let dependedTsConfig = extendedConfigToTsConfigPath.get(extendedConfig);
            if (!dependedTsConfig) {
                dependedTsConfig = new Set();
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
            configWatchers.set(tsconfigPath, tsSystem.watchFile(tsconfigPath, watchConfigCallback));
        }

        for (const config of extendedConfigPaths) {
            if (extendedConfigWatchers.has(config)) {
                continue;
            }

            extendedConfigWatchers.set(
                config,
                tsSystem.watchFile(config, createWatchExtendedConfigCallback(docContext))
            );
        }
    }

    async function watchConfigCallback(fileName: string, kind: ts.FileWatcherEventKind) {
        dispose();

        if (kind === ts.FileWatcherEventKind.Changed) {
            scheduleReload(fileName);
        } else if (kind === ts.FileWatcherEventKind.Deleted) {
            services.delete(fileName);
        }

        docContext.onProjectReloaded?.();
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
    return async (fileName: string) => {
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
 * schedule to the service reload to the next time the
 * service in requested
 * if there's still files opened it should be restarted
 * in the onProjectReloaded hooks
 */
function scheduleReload(fileName: string) {
    services.delete(fileName);
    pendingReloads.add(fileName);
}
