import path from 'path';
import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { findExports } from '../utils';
type _ts = typeof ts;

interface KitSnapshot {
    file: ts.IScriptSnapshot;
    version: string;
    addedCode: Array<{
        generatedPos: number;
        originalPos: number;
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

export const kitExports: Record<
    string,
    {
        displayParts: ts.SymbolDisplayPart[];
        documentation: ts.SymbolDisplayPart[];
        allowedIn: Array<'server' | 'universal' | 'layout' | 'page'>;
    }
> = {
    prerender: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'prerender',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'boolean',
                kind: 'keyword'
            },
            {
                text: ' | ',
                kind: 'punctuation'
            },
            {
                text: "'auto'",
                kind: 'stringLiteral'
            }
        ],
        documentation: [
            {
                text: 'Control whether or not this page is prerendered. More info: https://kit.svelte.dev/docs/page-options#prerender',
                kind: 'text'
            }
        ]
    },
    ssr: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'ssr',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'boolean',
                kind: 'keyword'
            }
        ],
        documentation: [
            {
                text: 'Control whether or not this page is server-side rendered. More info: https://kit.svelte.dev/docs/page-options#ssr',
                kind: 'text'
            }
        ]
    },
    csr: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'csr',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'boolean',
                kind: 'keyword'
            }
        ],
        documentation: [
            {
                text: 'Control whether or not this page is hydrated (i.e. if JS is delivered to the client). More info: https://kit.svelte.dev/docs/page-options#csr',
                kind: 'text'
            }
        ]
    },
    trailingSlash: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'trailingSlash',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: "'auto' | 'always' | 'never'",
                kind: 'stringLiteral'
            }
        ],
        documentation: [
            {
                text: 'Control how SvelteKit should handle (missing) trailing slashes in the URL. More info: https://kit.svelte.dev/docs/page-options#trailingslash',
                kind: 'text'
            }
        ]
    },
    config: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'config',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'Config',
                kind: 'interfaceName'
            }
        ],
        documentation: [
            {
                text:
                    `With the concept of adapters, SvelteKit is able to run on a variety of platforms. ` +
                    `Each of these might have specific configuration to further tweak the deployment, which you can configure here. ` +
                    `More info: https://kit.svelte.dev/docs/page-options#config`,
                kind: 'text'
            }
        ]
    },
    actions: {
        allowedIn: ['page', 'server'],
        displayParts: [
            {
                text: 'const',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'actions',
                kind: 'localName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'Actions',
                kind: 'interfaceName'
            }
        ],
        documentation: [
            {
                text:
                    `An object of methods which handle form POST requests. ` +
                    `More info: https://kit.svelte.dev/docs/form-actions`,
                kind: 'text'
            }
        ]
    },
    load: {
        allowedIn: ['layout', 'page', 'server', 'universal'],
        displayParts: [
            {
                text: 'export',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'function',
                kind: 'keyword'
            },
            {
                text: ' ',
                kind: 'space'
            },
            {
                text: 'load',
                kind: 'localName'
            },
            {
                text: '(',
                kind: 'punctuation'
            },
            {
                text: 'event',
                kind: 'parameterName'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'LoadEvent',
                kind: 'interfaceName'
            },
            {
                text: ')',
                kind: 'punctuation'
            },
            {
                text: ': ',
                kind: 'punctuation'
            },
            {
                text: 'Promise',
                kind: 'keyword'
            },
            {
                text: '<',
                kind: 'punctuation'
            },
            {
                text: 'LoadOutput',
                kind: 'interfaceName'
            },
            {
                text: '>',
                kind: 'punctuation'
            }
        ],
        documentation: [
            {
                text: 'Loads data for the given page or layout. More info: https://kit.svelte.dev/docs/load',
                kind: 'text'
            }
        ]
    }
};

export function getProxiedLanguageService(
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger?: Logger
) {
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

        resolveModuleNames = originalLanguageServiceHost.resolveModuleNames
            ? (...args: any[]) => {
                  return originalLanguageServiceHost.resolveModuleNames!(
                      // @ts-ignore
                      ...args
                  );
              }
            : undefined;

        resolveModuleNameLiterals = originalLanguageServiceHost.resolveModuleNameLiterals
            ? (...args: any[]) => {
                  return originalLanguageServiceHost.resolveModuleNameLiterals!(
                      // @ts-ignore
                      ...args
                  );
              }
            : undefined;

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
            const names: Set<string> = new Set(Object.keys(this.files));
            const files = originalLanguageServiceHost.getScriptFileNames();
            for (const file of files) {
                names.add(file);
            }
            return [...names];
        }

        getKitScriptSnapshotIfUpToDate(fileName: string) {
            if (
                !this.files[fileName] ||
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
                const insertionIdx = addedCode.findIndex((c) => c.generatedPos > pos);
                if (insertionIdx >= 0) {
                    for (let i = insertionIdx; i < addedCode.length; i++) {
                        addedCode[i].generatedPos += inserted.length;
                        addedCode[i].total += inserted.length;
                    }
                    const prevTotal = addedCode[insertionIdx - 1]?.total ?? 0;
                    addedCode.splice(insertionIdx, 0, {
                        generatedPos: pos + prevTotal,
                        originalPos: pos,
                        length: inserted.length,
                        inserted,
                        total: prevTotal + inserted.length
                    });
                } else {
                    const prevTotal = addedCode[addedCode.length - 1]?.total ?? 0;
                    addedCode.push({
                        generatedPos: pos + prevTotal,
                        originalPos: pos,
                        length: inserted.length,
                        inserted,
                        total: prevTotal + inserted.length
                    });
                }
            };

            const isTsFile = basename.endsWith('.ts');
            const exports = findExports(ts, source, isTsFile);

            // add type to load function if not explicitly typed
            const load = exports.get('load');
            if (
                load?.type === 'function' &&
                load.node.parameters.length === 1 &&
                !load.hasTypeDefinition
            ) {
                const pos = load.node.parameters[0].getEnd();
                const inserted = `: import('./$types').${
                    basename.includes('layout') ? 'Layout' : 'Page'
                }${basename.includes('server') ? 'Server' : ''}LoadEvent`;

                insert(pos, inserted);
            }

            // add type to actions variable if not explicitly typed
            const actions = exports.get('actions');
            if (actions?.type === 'var' && !actions.hasTypeDefinition && actions.node.initializer) {
                const pos = actions.node.initializer.getEnd();
                const inserted = ` satisfies import('./$types').Actions`;
                insert(pos, inserted);
            }

            // add type to prerender variable if not explicitly typed
            const prerender = exports.get('prerender');
            if (
                prerender?.type === 'var' &&
                !prerender.hasTypeDefinition &&
                prerender.node.initializer
            ) {
                const pos = prerender.node.name.getEnd();
                const inserted = ` : boolean | 'auto'`;
                insert(pos, inserted);
            }

            // add type to trailingSlash variable if not explicitly typed
            const trailingSlash = exports.get('trailingSlash');
            if (
                trailingSlash?.type === 'var' &&
                !trailingSlash.hasTypeDefinition &&
                trailingSlash.node.initializer
            ) {
                const pos = trailingSlash.node.name.getEnd();
                const inserted = ` : 'never' | 'always' | 'ignore'`; // TODO this should be exported from kit
                insert(pos, inserted);
            }

            // add type to ssr variable if not explicitly typed
            const ssr = exports.get('ssr');
            if (ssr?.type === 'var' && !ssr.hasTypeDefinition && ssr.node.initializer) {
                const pos = ssr.node.name.getEnd();
                const inserted = ` : boolean`;
                insert(pos, inserted);
            }

            // add type to csr variable if not explicitly typed
            const csr = exports.get('csr');
            if (csr?.type === 'var' && !csr.hasTypeDefinition && csr.node.initializer) {
                const pos = csr.node.name.getEnd();
                const inserted = ` : boolean`;
                insert(pos, inserted);
            }

            // construct generated text from internal text and addedCode array
            const originalText = source.getFullText();
            let pos = 0;
            let text = '';
            for (const added of addedCode) {
                text += originalText.slice(pos, added.originalPos) + added.inserted;
                pos = added.originalPos;
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
    const proxy = getProxiedLanguageService(info, ts, logger);
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
        if (pos < added.originalPos) break;
        total += added.length;
    }
    return pos + total;
}

export function toOriginalPos(pos: number, addedCode: KitSnapshot['addedCode']) {
    let total = 0;
    let idx = 0;
    for (; idx < addedCode.length; idx++) {
        const added = addedCode[idx];
        if (pos < added.generatedPos) break;
        total += added.length;
    }

    if (idx > 0) {
        const prev = addedCode[idx - 1];
        // If pos is in the middle of an added range, return the start of the addition
        if (pos > prev.generatedPos && pos < prev.generatedPos + prev.length) {
            return { pos: prev.originalPos, inGenerated: true };
        }
    }

    return { pos: pos - total, inGenerated: false };
}
