import ts from 'typescript';
import { DocumentSnapshot } from './DocumentSnapshot';
import { isSvelte } from './utils';
import { dirname, resolve, extname } from 'path';
import { Document } from '../../api';

export function createLanguageService() {
    const workspacePath = ''; // TODO
    const documents = new Map<string, DocumentSnapshot>();

    let defaultCompilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
    };
    let current: { files: string[]; compilerOptions: ts.CompilerOptions } = {
        compilerOptions: defaultCompilerOptions,
        files: [],
    };

    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => current.compilerOptions,
        getScriptFileNames: () =>
            Array.from(new Set([...current.files, ...Array.from(documents.keys())])),
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
                    current.compilerOptions,
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
        const newSnapshot = DocumentSnapshot.fromDocument(
            document,
            defaultCompilerOptions,
            preSnapshot,
        );
        if (preSnapshot && preSnapshot.scriptKind !== newSnapshot.scriptKind) {
            // Restart language service as it doesn't handle script kind changes.
            languageService.dispose();
            languageService = ts.createLanguageService(host);
        }

        documents.set(document.getFilePath()!, newSnapshot);
        current = newSnapshot;
        return languageService;
    }
}
