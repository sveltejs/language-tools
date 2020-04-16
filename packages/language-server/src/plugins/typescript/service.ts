import { dirname, resolve } from 'path';
import ts from 'typescript';
import { getSveltePackageInfo } from '../svelte/sveltePackage';
import { DocumentSnapshot } from './DocumentSnapshot';
import { createSvelteModuleLoader } from './module-loader';
import { ensureRealSvelteFilePath, getScriptKindFromFileName, isSvelteFilePath } from './utils';
import { TypescriptDocument } from './TypescriptDocument';

export interface LanguageServiceContainer {
    getService(): ts.LanguageService;
    updateDocument(document: TypescriptDocument): ts.LanguageService;
}

const services = new Map<string, LanguageServiceContainer>();

export type CreateDocument = (fileName: string, content: string) => TypescriptDocument;

export function getLanguageServiceForDocument(
    document: TypescriptDocument,
    createDocument: CreateDocument,
): ts.LanguageService {
    const searchDir = dirname(document.getFilePath()!);
    const tsconfigPath =
        ts.findConfigFile(searchDir, ts.sys.fileExists, 'tsconfig.json') ||
        ts.findConfigFile(searchDir, ts.sys.fileExists, 'jsconfig.json') ||
        '';

    let service: LanguageServiceContainer;
    if (services.has(tsconfigPath)) {
        service = services.get(tsconfigPath)!;
    } else {
        service = createLanguageService(tsconfigPath, createDocument);
        services.set(tsconfigPath, service);
    }

    return service.updateDocument(document);
}

export function createLanguageService(
    tsconfigPath: string,
    createDocument: CreateDocument,
): LanguageServiceContainer {
    const workspacePath = tsconfigPath ? dirname(tsconfigPath) : '';
    const documents = new Map<string, DocumentSnapshot>();
    const sveltePkgInfo = getSveltePackageInfo(workspacePath);

    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
        types: [resolve(sveltePkgInfo.path, 'types', 'runtime')],
    };

    const configJson = tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config;
    let files: string[] = [];
    if (configJson) {
        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            ts.sys,
            workspacePath,
            compilerOptions,
            tsconfigPath,
            undefined,
            [{ extension: 'svelte', isMixedContent: true }],
        );
        files = parsedConfig.fileNames;
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }

    const svelteModuleLoader = createSvelteModuleLoader(getSvelteSnapshot, compilerOptions);

    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => Array.from(new Set([...files, ...Array.from(documents.keys())])),
        getScriptVersion(fileName: string) {
            const doc = getSvelteSnapshot(fileName);
            return doc ? String(doc.version) : '0';
        },
        getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
            const doc = getSvelteSnapshot(fileName);
            if (doc) {
                return doc;
            }

            return ts.ScriptSnapshot.fromString(this.readFile!(fileName) || '');
        },
        getCurrentDirectory: () => workspacePath,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        fileExists: svelteModuleLoader.fileExists,
        readFile: svelteModuleLoader.readFile,
        resolveModuleNames: svelteModuleLoader.resolveModuleNames,
        readDirectory: ts.sys.readDirectory,
        getScriptKind: (fileName: string) => {
            const doc = getSvelteSnapshot(fileName);
            if (doc) {
                return doc.scriptKind;
            }

            return getScriptKindFromFileName(fileName);
        },
    };
    let languageService = ts.createLanguageService(host);

    return {
        getService: () => languageService,
        updateDocument,
    };

    function updateDocument(document: TypescriptDocument): ts.LanguageService {
        const preSnapshot = documents.get(document.getFilePath()!);
        const newSnapshot = DocumentSnapshot.fromDocument(document);
        if (preSnapshot && preSnapshot.scriptKind !== newSnapshot.scriptKind) {
            // Restart language service as it doesn't handle script kind changes.
            languageService.dispose();
            languageService = ts.createLanguageService(host);
        }

        documents.set(document.getFilePath()!, newSnapshot);
        return languageService;
    }

    function getSvelteSnapshot(fileName: string): DocumentSnapshot | undefined {
        fileName = ensureRealSvelteFilePath(fileName);
        const doc = documents.get(fileName);
        if (doc) {
            return doc;
        }

        if (isSvelteFilePath(fileName)) {
            const file = ts.sys.readFile(fileName) || '';
            const doc = DocumentSnapshot.fromDocument(createDocument(fileName, file));
            documents.set(fileName, doc);
            return doc;
        }
    }
}
