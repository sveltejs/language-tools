import ts from 'typescript';
import { DocumentSnapshot } from './DocumentSnapshot';
import { isSvelte } from './utils';
import { dirname, resolve, extname } from 'path';
import { Document } from '../../api';

export function createLanguageService() {
    const workspacePath = ''; // TODO
    const documents = new Map<string, DocumentSnapshot>();

    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
    };

    // Grab tsconfig file
    const configFilename =
        ts.findConfigFile(workspacePath, ts.sys.fileExists, 'tsconfig.json') ||
        ts.findConfigFile(workspacePath, ts.sys.fileExists, 'jsconfig.json');
    const configJson = configFilename && ts.readConfigFile(configFilename, ts.sys.readFile).config;
    let files: string[] = [];
    if (configJson) {
        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            ts.sys,
            workspacePath,
            compilerOptions,
            configFilename,
            undefined,
            [
                { extension: 'html', isMixedContent: true },
                { extension: 'svelte', isMixedContent: true },
            ],
        );
        files = parsedConfig.fileNames;
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }

    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => Array.from(new Set([...files, ...Array.from(documents.keys())])),
        getScriptVersion(fileName: string) {
            const doc = documents.get(fileName);
            return doc ? String(doc.version) : '0';
        },
        getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
            const doc = documents.get(fileName);
            if (doc) {
                return doc;
            }

            return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) || '');
        },
        getCurrentDirectory: () => workspacePath,
        getDefaultLibFileName: ts.getDefaultLibFilePath,

        resolveModuleNames(moduleNames: string[], containingFile: string): ts.ResolvedModule[] {
            return moduleNames.map(name => {
                const resolved = ts.resolveModuleName(
                    name,
                    containingFile,
                    compilerOptions,
                    ts.sys,
                );

                if (!resolved.resolvedModule && isSvelte(name)) {
                    return {
                        resolvedFileName: resolve(dirname(containingFile), name),
                        extension: extname(name),
                    };
                }

                return resolved.resolvedModule!;
            });
        },
    };
    let languageService = ts.createLanguageService(host);

    return {
        getService: () => languageService,
        updateDocument,
    };

    function updateDocument(document: Document): ts.LanguageService {
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
}
