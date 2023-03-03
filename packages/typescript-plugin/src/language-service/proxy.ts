import path from 'path';
import type typescript from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
type _ts = typeof typescript;

interface KitSnapshot {
    file: ts.IScriptSnapshot;
    version: string;
    addedCode: Array<{
        pos: number;
        length: number;
        total: number;
        inserted: string;
    }>;
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

export function getProxiedLanguageService(info: ts.server.PluginCreateInfo, ts: _ts) {
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

            const addedCode: KitSnapshot['addedCode'] = [];
            const insert = (pos: number, inserted: string) => {
                const prevTotal = addedCode[addedCode.length - 1]?.total ?? 0;
                addedCode.push({
                    pos: pos + prevTotal,
                    length: inserted.length,
                    inserted,
                    total: prevTotal + inserted.length
                });
            };

            const exports = findExports(source, ts);
            const isTsFile = basename.endsWith('.ts');

            // add type to load function if not explicitly typed
            const load = exports.get('load');
            if (
                load?.type === 'function' &&
                load.node.parameters.length === 1 &&
                !load.node.parameters[0].type &&
                (isTsFile || !ts.getJSDocType(load.node))
            ) {
                const pos = load.node.parameters[0].getEnd();
                const inserted = `: import('./$types').${
                    basename.includes('layout') ? 'Layout' : 'Page'
                }${basename.includes('server') ? 'Server' : ''}LoadEvent`;

                insert(pos, inserted);
            }

            // add type to actions variable if not explicitly typed
            const actions = exports.get('actions');
            if (
                actions?.type === 'var' &&
                !actions.node.type &&
                (isTsFile || !ts.getJSDocType(actions.node)) &&
                actions.node.initializer &&
                ts.isObjectLiteralExpression(actions.node.initializer)
            ) {
                const pos = actions.node.initializer.getEnd();
                const inserted = `satisfies import('./$types').Actions`;
                insert(pos, inserted);
            }

            // construct generated text from internal text and addedCode array
            const originalText = source.getFullText();
            let pos = 0;
            let text = '';
            for (const added of addedCode) {
                const nextPos = added.pos - added.total + added.length;
                text += originalText.slice(pos, nextPos) + added.inserted;
                pos = nextPos;
            }
            text += originalText.slice(pos);

            const snap = ts.ScriptSnapshot.fromString(text);
            snap.getChangeRange = (_) => undefined;
            this.files[fileName] = {
                version: originalLanguageServiceHost.getScriptVersion(fileName),
                file: snap,
                addedCode
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
    ts: _ts,
    logger?: Logger
) {
    const proxy = getProxiedLanguageService(info, ts);
    const result =
        proxy.languageServiceHost.getKitScriptSnapshotIfUpToDate(fileName) ??
        proxy.languageServiceHost.upsertKitFile(fileName);
    if (result) {
        return {
            languageService: proxy.languageService,
            addedCode: result.addedCode,
            toVirtualPos: (pos: number) => toVirtualPos(pos, result.addedCode),
            toOriginalPos: (pos: number) => toOriginalPos(pos, result.addedCode)
        };
    }
}

export function toVirtualPos(pos: number, addedCode: KitSnapshot['addedCode']) {
    let total = 0;
    for (const added of addedCode) {
        if (pos < added.pos) break;
        total += added.length;
    }
    return pos + total;
}

export function toOriginalPos(pos: number, addedCode: KitSnapshot['addedCode']) {
    let total = 0;
    let idx = 0;
    for (; idx < addedCode.length; idx++) {
        const added = addedCode[idx];
        if (pos < added.pos) break;
        total += added.length;
    }

    if (idx > 0) {
        const prev = addedCode[idx - 1];
        // If pos is in the middle of an added range, return the start of the addition
        if (pos > prev.pos && pos < prev.pos + prev.length) {
            return { pos: prev.pos - prev.total + prev.length, inGenerated: true };
        }
    }

    return { pos: pos - total, inGenerated: false };
}

/**
 * Finds the top level const/let/function exports of a source file.
 */
function findExports(source: ts.SourceFile, ts: _ts) {
    const exports = new Map<
        string,
        | {
              type: 'function';
              node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
          }
        | { type: 'var'; node: ts.VariableDeclaration }
    >();
    // TODO handle indirect exports?
    for (const statement of source.statements) {
        if (
            ts.isFunctionDeclaration(statement) &&
            statement.name &&
            statement.modifiers?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export function x ...
            exports.set(statement.name.text, { type: 'function', node: statement });
        }
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.length === 1 &&
            statement.modifiers?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export const x = ...
            const declaration = statement.declarationList.declarations[0];
            if (
                declaration.initializer &&
                (ts.isFunctionExpression(declaration.initializer) ||
                    ts.isArrowFunction(declaration.initializer))
            ) {
                exports.set(declaration.name.getText(), {
                    type: 'function',
                    node: declaration.initializer
                });
            } else {
                exports.set(declaration.name.getText(), { type: 'var', node: declaration });
            }
        }
    }

    return exports;
}
