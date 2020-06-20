import { dirname, resolve } from 'path';
import ts from 'typescript';
import { Document } from '../../lib/documents';
import { Logger } from '../../logger';
import { getPackageInfo } from '../importPackage';
import { DocumentSnapshot } from './DocumentSnapshot';
import { createSvelteModuleLoader } from './module-loader';
import { SnapshotManager } from './SnapshotManager';
import { ensureRealSvelteFilePath, findTsConfigPath, isSvelteFilePath } from './utils';

export interface LanguageServiceContainer {
    readonly tsconfigPath: string;
    readonly compilerOptions: ts.CompilerOptions;
    readonly snapshotManager: SnapshotManager;
    getService(): ts.LanguageService;
    updateDocument(document: Document): ts.LanguageService;
    deleteDocument(filePath: string): void;
}

const services = new Map<string, LanguageServiceContainer>();

export type CreateDocument = (fileName: string, content: string) => Document;

export function getLanguageServiceForPath(
    path: string,
    workspacePath: string,
    createDocument: CreateDocument,
): ts.LanguageService {
    return getService(path, workspacePath, createDocument).getService();
}

export function getLanguageServiceForDocument(
    document: Document,
    workspacePath: string,
    createDocument: CreateDocument,
): ts.LanguageService {
    return getService(document.getFilePath() || '', workspacePath, createDocument).updateDocument(
        document,
    );
}

export function getService(path: string, workspacePath: string, createDocument: CreateDocument) {
    const tsconfigPath = findTsConfigPath(path, workspacePath);

    let service: LanguageServiceContainer;
    if (services.has(tsconfigPath)) {
        service = services.get(tsconfigPath)!;
    } else {
        Logger.log('Initialize new ts service at ', tsconfigPath);
        service = createLanguageService(tsconfigPath, createDocument);
        services.set(tsconfigPath, service);
    }

    return service;
}

export function createLanguageService(
    tsconfigPath: string,
    createDocument: CreateDocument,
): LanguageServiceContainer {
    const workspacePath = tsconfigPath ? dirname(tsconfigPath) : '';

    const { compilerOptions, files } = getCompilerOptionsAndProjectFiles();
    const snapshotManager = new SnapshotManager(files);

    const svelteModuleLoader = createSvelteModuleLoader(getSnapshot, compilerOptions);

    const svelteTsPath = dirname(require.resolve('svelte2tsx'));
    const svelteTsxFiles = ['./svelte-shims.d.ts', './svelte-jsx.d.ts'].map((f) =>
        ts.sys.resolvePath(resolve(svelteTsPath, f)),
    );

    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => Array.from(new Set([
            ...snapshotManager.getProjectFileNames(),
            ...snapshotManager.getFileNames(),
            ...svelteTsxFiles
        ])),
        getScriptVersion: (fileName: string) => getSnapshot(fileName).version.toString(),
        getScriptSnapshot: getSnapshot,
        getCurrentDirectory: () => workspacePath,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        fileExists: svelteModuleLoader.fileExists,
        readFile: svelteModuleLoader.readFile,
        resolveModuleNames: svelteModuleLoader.resolveModuleNames,
        readDirectory: svelteModuleLoader.readDirectory,
        getDirectories: ts.sys.getDirectories,
        // vscode's uri is all lowercase
        useCaseSensitiveFileNames: () => false,
        getScriptKind: (fileName: string) => getSnapshot(fileName).scriptKind,
    };
    let languageService = ts.createLanguageService(host);

    return {
        tsconfigPath,
        compilerOptions,
        getService: () => languageService,
        updateDocument,
        deleteDocument,
        snapshotManager
    };

    function deleteDocument(filePath: string): void {
        svelteModuleLoader.deleteFromModuleCache(filePath);
        snapshotManager.delete(filePath);
    }

    function updateDocument(document: Document): ts.LanguageService {
        const preSnapshot = snapshotManager.get(document.getFilePath()!);

        // Don't reinitialize document if no update needed.
        if (preSnapshot?.version === document.version) {
            return languageService;
        }

        const newSnapshot = DocumentSnapshot.fromDocument(document, {
            strictMode: !!compilerOptions.strict,
        });
        if (preSnapshot && preSnapshot.scriptKind !== newSnapshot.scriptKind) {
            // Restart language service as it doesn't handle script kind changes.
            languageService.dispose();
            languageService = ts.createLanguageService(host);
        }

        snapshotManager.set(document.getFilePath()!, newSnapshot);
        return languageService;
    }

    function getSnapshot(fileName: string): DocumentSnapshot {
        fileName = ensureRealSvelteFilePath(fileName);

        let doc = snapshotManager.get(fileName);
        if (doc) {
            return doc;
        }

        if (isSvelteFilePath(fileName)) {
            const file = ts.sys.readFile(fileName) || '';
            doc = DocumentSnapshot.fromDocument(createDocument(fileName, file), {
                strictMode: !!compilerOptions.strict,
            });
        } else {
            doc = DocumentSnapshot.fromFilePath(fileName, { strictMode: !!compilerOptions.strict });
        }

        snapshotManager.set(fileName, doc);
        return doc;
    }

    function getCompilerOptionsAndProjectFiles() {
        const forcedCompilerOptions: ts.CompilerOptions = {
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.Latest,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            allowJs: true,
            noEmit: true,
            declaration: false,
            skipLibCheck: true,
            // these are needed to handle the results of svelte2tsx preprocessing:
            jsx: ts.JsxEmit.Preserve,
            jsxFactory: 'h',
        };

        // always let ts parse config to get default compilerOption
        let configJson = (
            tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config
        ) || {
            compilerOptions: getDeaultJsCompilerOption()
        };

        // Only default exclude when no extends for now
        if (!configJson.extends) {
            configJson = Object.assign({
                exclude: getDefaultExclude()
            }, configJson);
        }

        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            ts.sys,
            workspacePath,
            forcedCompilerOptions,
            tsconfigPath,
            undefined,
            [{ extension: 'svelte', isMixedContent: false, scriptKind: ts.ScriptKind.TSX }],
        );

        const files = parsedConfig.fileNames;

        const sveltePkgInfo = getPackageInfo('svelte', workspacePath || process.cwd());
        const compilerOptions: ts.CompilerOptions = {
            types: [resolve(sveltePkgInfo.path, 'types', 'runtime')],
            ...parsedConfig.options,
            ...forcedCompilerOptions,
        };

        return { compilerOptions, files };
    }

    /**
     * this should only be used when no jsconfig/tsconfig at all
     */
    function getDeaultJsCompilerOption(): ts.CompilerOptions {
        return {
            maxNodeModuleJsDepth: 2,
            allowSyntheticDefaultImports: true,
        };
    }

    function getDefaultExclude() {
        return [
            '__sapper__',
            'node_modules'
        ];
    }
}
