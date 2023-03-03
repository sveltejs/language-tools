import path from 'path';
import type typescript from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';

interface KitSnapshot {
    file: ts.IScriptSnapshot;
    version: string;
    pos: number;
    length: number;
}

const cache = new WeakMap<
    ts.server.PluginCreateInfo,
    {
        languageService: ts.LanguageService;
        languageServiceHost: ts.LanguageServiceHost & {
            getKitScriptSnapshotIfUpToDate: (fileName: string) => KitSnapshot | undefined;
            upsertKitFile: (fileName: string) => void;
        };
    }
>();

export function getProxiedLanguageService(info: ts.server.PluginCreateInfo, ts: typeof typescript) {
    const cachedProxiedLanguageService = cache.get(info);
    if (cachedProxiedLanguageService) {
        return cachedProxiedLanguageService;
    }

    const originalLanguageServiceHost = info.languageServiceHost;

    class ProxiedLanguageServiceHost implements ts.LanguageServiceHost {
        files: Record<string, KitSnapshot> = {};

        log() {}
        trace() {}
        error() {}
        getCompilationSettings() {
            return originalLanguageServiceHost.getCompilationSettings();
        }
        getScriptIsOpen() {
            return true;
        }
        getCurrentDirectory() {
            return originalLanguageServiceHost.getCurrentDirectory();
        }
        getDefaultLibFileName(o: any) {
            return originalLanguageServiceHost.getDefaultLibFileName(o);
        }

        getScriptVersion(fileName: string) {
            const file = this.files[fileName];
            if (!file) return originalLanguageServiceHost.getScriptVersion(fileName);
            return file.version.toString();
        }

        getScriptSnapshot(fileName: string) {
            const file = this.files[fileName];
            if (!file) return originalLanguageServiceHost.getScriptSnapshot(fileName);
            return file.file;
        }

        getScriptFileNames(): string[] {
            const names: Set<string> = new Set();
            for (var name in this.files) {
                if (this.files.hasOwnProperty(name)) {
                    names.add(name);
                }
            }
            const files = originalLanguageServiceHost.getScriptFileNames();
            for (const file of files) {
                names.add(file);
            }
            return [...names];
        }

        getKitScriptSnapshotIfUpToDate(fileName: string) {
            if (
                this.getScriptVersion(fileName) !==
                originalLanguageServiceHost.getScriptVersion(fileName)
            ) {
                return undefined;
            }
            return this.files[fileName];
        }

        upsertKitFile(fileName: string) {
            const basename = path.basename(fileName);
            if (!kitPageFiles.has(basename)) return;

            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) return;

            const load = findTopLevelFunction(source, ts, 'load');
            if (!load || load.parameters.length !== 1 || load.parameters[0].type) return;

            const text = source.getFullText();
            const pos = load.parameters[0].getEnd();
            // TODO JSDoc for JS files
            const typeInsertion = `: import('./$types').${
                basename.includes('layout') ? 'Layout' : 'Page'
            }${basename.includes('server') ? 'Server' : ''}LoadEvent`;
            // {start,length,totalLength} array when multiple replacements (action + load + exports)
            const length = typeInsertion.length;

            const snap = ts.ScriptSnapshot.fromString(
                text.slice(0, pos) + typeInsertion + text.slice(pos)
            );
            snap.getChangeRange = (_) => undefined;
            this.files[fileName] = {
                version: originalLanguageServiceHost.getScriptVersion(fileName),
                file: snap,
                pos,
                length
            };
            return this.files[fileName];
        }

        readFile(fileName: string) {
            const file = this.files[fileName];
            return file
                ? file.file.getText(0, file.file.getLength())
                : originalLanguageServiceHost.readFile(fileName);
        }

        fileExists(fileName: string) {
            return (
                this.files[fileName] !== undefined ||
                originalLanguageServiceHost.fileExists(fileName)
            );
        }
    }

    const languageServiceHost = new ProxiedLanguageServiceHost();
    const languageService = ts.createLanguageService(
        languageServiceHost,
        ts.createDocumentRegistry()
    );
    cache.set(info, { languageService, languageServiceHost });
    return {
        languageService,
        languageServiceHost
    };
}

const kitPageFiles = new Set([
    '+page.ts',
    '+page.js',
    '+layout.ts',
    '+layout.js',
    '+page.server.ts',
    '+page.server.js',
    '+layout.server.ts',
    '+layout.server.js'
]);

export function getVirtualLS(
    fileName: string,
    info: ts.server.PluginCreateInfo,
    ts: typeof typescript,
    logger?: Logger
) {
    const proxy = getProxiedLanguageService(info, ts);
    const result =
        proxy.languageServiceHost.getKitScriptSnapshotIfUpToDate(fileName) ??
        proxy.languageServiceHost.upsertKitFile(fileName);
    if (result) {
        return {
            languageService: proxy.languageService,
            pos: result.pos,
            length: result.length
        };
    }
}

function findTopLevelFunction(source: ts.SourceFile, ts: typeof typescript, name: string) {
    // TODO handle indirect exports
    for (const statement of source.statements) {
        if (
            ts.isFunctionDeclaration(statement) &&
            statement.name &&
            statement.name.text === name &&
            statement.modifiers?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export function x ...
            return statement;
        }
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.length === 1 &&
            statement.declarationList.declarations[0].name.getText() === name &&
            statement.modifiers?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export const x = ...
            const declaration = statement.declarationList.declarations[0];
            if (
                declaration.initializer &&
                (ts.isFunctionExpression(declaration.initializer) ||
                    ts.isArrowFunction(declaration.initializer))
            ) {
                // this doesn't match `(() => {}) satisfies ..`, AST is different for it
                return declaration.initializer;
            }
        }
    }
}
