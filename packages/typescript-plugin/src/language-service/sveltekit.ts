import path from 'path';
import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { findExports, hasNodeModule } from '../utils';
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
    } | null
>();

function createApiExport(name: string) {
    return {
        allowedIn: ['api', 'server'] as ['api', 'server'],
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
                text: 'async',
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
                text: name,
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
                text: 'RequestEvent',
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
                text: 'Response',
                kind: 'interfaceName'
            },
            {
                text: '>',
                kind: 'punctuation'
            }
        ],
        documentation: [
            {
                text: `Handles ${name} requests. More info: https://kit.svelte.dev/docs/routing#server`,
                kind: 'text'
            }
        ]
    };
}

export const kitExports: Record<
    string,
    {
        displayParts: ts.SymbolDisplayPart[];
        documentation: ts.SymbolDisplayPart[];
        allowedIn: Array<'server' | 'universal' | 'layout' | 'page' | 'api'>;
    }
> = {
    prerender: {
        allowedIn: ['layout', 'page', 'api', 'server', 'universal'],
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
        allowedIn: ['layout', 'page', 'api', 'server', 'universal'],
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
        allowedIn: ['layout', 'page', 'api', 'server', 'universal'],
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
    },
    GET: createApiExport('GET'),
    POST: createApiExport('POST'),
    PUT: createApiExport('PUT'),
    PATCH: createApiExport('PATCH'),
    DELETE: createApiExport('DELETE'),
    OPTIONS: createApiExport('OPTIONS'),
    // param matching
    match: {
        allowedIn: [],
        displayParts: [],
        documentation: [
            {
                text:
                    `A parameter matcher. ` +
                    `More info: https://kit.svelte.dev/docs/advanced-routing#matching`,
                kind: 'text'
            }
        ]
    },
    // hooks
    handle: {
        allowedIn: [],
        displayParts: [],
        documentation: [
            {
                text:
                    `The  handle hook runs every time the SvelteKit server receives a request and determines the response. ` +
                    `It receives an 'event' object representing the request and a function called 'resolve', which renders the route and generates a Response. ` +
                    `This allows you to modify response headers or bodies, or bypass SvelteKit entirely (for implementing routes programmatically, for example). ` +
                    `More info: https://kit.svelte.dev/docs/hooks#server-hooks-handle`,
                kind: 'text'
            }
        ]
    },
    handleFetch: {
        allowedIn: [],
        displayParts: [],
        documentation: [
            {
                text:
                    `The handleFetch hook allows you to modify (or replace) a 'fetch' request that happens inside a 'load' function that runs on the server (or during pre-rendering). ` +
                    `More info: https://kit.svelte.dev/docs/hooks#server-hooks-handlefetch`,
                kind: 'text'
            }
        ]
    },
    handleError: {
        allowedIn: [],
        displayParts: [],
        documentation: [
            {
                text:
                    `The handleError hook runs when an unexpected error is thrown while responding to a request. ` +
                    `If an unexpected error is thrown during loading or rendering, this function will be called with the error and the event. ` +
                    `Make sure that this function _never_ throws an error. ` +
                    `More info: https://kit.svelte.dev/docs/hooks#shared-hooks-handleerror`,
                kind: 'text'
            }
        ]
    }
};

export function isKitRouteExportAllowedIn(
    basename: string,
    kitExport: typeof kitExports[keyof typeof kitExports]
) {
    if (!basename.startsWith('+')) {
        return false;
    }

    const allowedIn = kitExport.allowedIn;
    return (
        (basename.includes('layout')
            ? allowedIn.includes('layout')
            : basename.includes('+server')
            ? allowedIn.includes('api')
            : allowedIn.includes('page')) &&
        (basename.includes('server')
            ? allowedIn.includes('server')
            : allowedIn.includes('universal'))
    );
}

const kitPageFiles = new Set(['+page', '+layout', '+page.server', '+layout.server', '+server']);

function getProxiedLanguageService(info: ts.server.PluginCreateInfo, ts: _ts, logger?: Logger) {
    const cachedProxiedLanguageService = cache.get(info);
    if (cachedProxiedLanguageService !== undefined) {
        return cachedProxiedLanguageService ?? undefined;
    }

    if (!hasNodeModule(info.project.getCompilerOptions(), '@sveltejs/kit')) {
        // Not a SvelteKit project, do nothing
        cache.set(info, null);
        return;
    }

    const originalLanguageServiceHost = info.languageServiceHost;

    class ProxiedLanguageServiceHost implements ts.LanguageServiceHost {
        private files: Record<string, KitSnapshot> = {};
        private paramsPath = 'src/params';
        private serverHooksPath = 'src/hooks.server';
        private clientHooksPath = 'src/hooks.client';

        constructor() {
            const configPath = info.project.getCurrentDirectory() + '/svelte.config.js';
            import(configPath)
                .then((module) => {
                    const config = module.default;
                    if (config.kit && config.kit.files) {
                        if (config.kit.files.params) {
                            this.paramsPath = config.kit.files.params;
                        }
                        if (config.kit.files.hooks) {
                            this.serverHooksPath ||= config.kit.files.hooks.server;
                            this.clientHooksPath ||= config.kit.files.hooks.client;
                        }
                        // We could be more sophisticated with only removing the files that are actually
                        // wrong but this is good enough given how rare it is that this setting is used
                        Object.keys(this.files)
                            .filter((name) => {
                                return !name.includes('src/hooks') && !name.includes('src/params');
                            })
                            .forEach((name) => {
                                delete this.files[name];
                            });
                    }
                })
                .catch(() => {});
        }

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
            let basename = path.basename(fileName);
            const result =
                this.upserKitRouteFile(fileName, basename) ??
                this.upserKitServerHooksFile(fileName, basename) ??
                this.upserKitClientHooksFile(fileName, basename) ??
                this.upserKitParamsFile(fileName, basename);
            if (!result) {
                return;
            }

            // construct generated text from internal text and addedCode array
            const { originalText, addedCode } = result;
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

        private upserKitRouteFile(fileName: string, basename: string) {
            if (basename.includes('@')) {
                // +page@foo -> +page
                basename = basename.split('@')[0];
            } else {
                basename = basename.slice(0, -path.extname(fileName).length);
            }
            if (!kitPageFiles.has(basename)) return;

            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) return;

            const addedCode: KitSnapshot['addedCode'] = [];
            const insert = (pos: number, inserted: string) => {
                this.insertCode(addedCode, pos, inserted);
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

            // add types to GET/PUT/POST/PATCH/DELETE/OPTIONS if not explicitly typed
            const insertApiMethod = (name: string) => {
                const api = exports.get(name);
                if (
                    api?.type === 'function' &&
                    api.node.parameters.length === 1 &&
                    !api.hasTypeDefinition
                ) {
                    const pos = api.node.parameters[0].getEnd();
                    const inserted = `: import('./$types').RequestHandler`;

                    insert(pos, inserted);
                }
            };
            insertApiMethod('GET');
            insertApiMethod('PUT');
            insertApiMethod('POST');
            insertApiMethod('PATCH');
            insertApiMethod('DELETE');
            insertApiMethod('OPTIONS');

            return { addedCode, originalText: source.getFullText() };
        }

        private upserKitParamsFile(fileName: string, basename: string) {
            if (
                !fileName.slice(0, -basename.length - 1).endsWith(this.paramsPath) ||
                basename.includes('.test') ||
                basename.includes('.spec')
            ) {
                return;
            }

            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) return;

            const addedCode: KitSnapshot['addedCode'] = [];
            const insert = (pos: number, inserted: string) => {
                this.insertCode(addedCode, pos, inserted);
            };

            const isTsFile = basename.endsWith('.ts');
            const exports = findExports(ts, source, isTsFile);

            // add type to match function if not explicitly typed
            const match = exports.get('match');
            if (
                match?.type === 'function' &&
                match.node.parameters.length === 1 &&
                !match.hasTypeDefinition
            ) {
                const pos = match.node.parameters[0].getEnd();
                const inserted = `: string`;
                insert(pos, inserted);
                if (!match.node.type && match.node.body) {
                    const returnPos = match.node.body.getStart();
                    const returnInsertion = `: boolean`;
                    insert(returnPos, returnInsertion);
                }
            }

            return { addedCode, originalText: source.getFullText() };
        }

        private upserKitClientHooksFile(fileName: string, basename: string) {
            const matchesHooksFile =
                ((basename === 'index.ts' || basename === 'index.js') &&
                    fileName.slice(0, -basename.length - 1).endsWith(this.clientHooksPath)) ||
                fileName.slice(0, -path.extname(basename).length).endsWith(this.clientHooksPath);
            if (!matchesHooksFile) {
                return;
            }

            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) return;

            const addedCode: KitSnapshot['addedCode'] = [];
            const insert = (pos: number, inserted: string) => {
                this.insertCode(addedCode, pos, inserted);
            };

            const isTsFile = basename.endsWith('.ts');
            const exports = findExports(ts, source, isTsFile);

            // add type to handleError function if not explicitly typed
            const handleError = exports.get('handleError');
            if (
                handleError?.type === 'function' &&
                handleError.node.parameters.length === 1 &&
                !handleError.hasTypeDefinition
            ) {
                const paramPos = handleError.node.parameters[0].getEnd();
                const paramInsertion = `: Parameters<import('@sveltejs/kit').HandleClientError>[0]`;
                insert(paramPos, paramInsertion);
                if (!handleError.node.type && handleError.node.body) {
                    const returnPos = handleError.node.body.getStart();
                    const returnInsertion = `: ReturnType<import('@sveltejs/kit').HandleClientError>`;
                    insert(returnPos, returnInsertion);
                }
            }

            return { addedCode, originalText: source.getFullText() };
        }

        private upserKitServerHooksFile(fileName: string, basename: string) {
            const matchesHooksFile =
                ((basename === 'index.ts' || basename === 'index.js') &&
                    fileName.slice(0, -basename.length - 1).endsWith(this.serverHooksPath)) ||
                fileName.slice(0, -path.extname(basename).length).endsWith(this.serverHooksPath);
            if (!matchesHooksFile) {
                return;
            }

            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) return;

            const addedCode: KitSnapshot['addedCode'] = [];
            const insert = (pos: number, inserted: string) => {
                this.insertCode(addedCode, pos, inserted);
            };

            const isTsFile = basename.endsWith('.ts');
            const exports = findExports(ts, source, isTsFile);

            const addTypeToFunction = (name: string, type: string) => {
                const fn = exports.get(name);
                if (
                    fn?.type === 'function' &&
                    fn.node.parameters.length === 1 &&
                    !fn.hasTypeDefinition
                ) {
                    const paramPos = fn.node.parameters[0].getEnd();
                    const paramInsertion = `: Parameters<${type}>[0]`;
                    insert(paramPos, paramInsertion);
                    if (!fn.node.type && fn.node.body) {
                        const returnPos = fn.node.body.getStart();
                        const returnInsertion = `: ReturnType<${type}>`;
                        insert(returnPos, returnInsertion);
                    }
                }
            };

            addTypeToFunction('handleError', `import('@sveltejs/kit').HandleServerError`);
            addTypeToFunction('handle', `import('@sveltejs/kit').Handle`);
            addTypeToFunction('handleFetch', `import('@sveltejs/kit').HandleFetch`);

            return { addedCode, originalText: source.getFullText() };
        }

        private insertCode(addedCode: KitSnapshot['addedCode'], pos: number, inserted: string) {
            const insertionIdx = addedCode.findIndex((c) => c.originalPos > pos);
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

export function getVirtualLS(
    fileName: string,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger?: Logger
) {
    const proxy = getProxiedLanguageService(info, ts, logger);
    if (!proxy) {
        return;
    }

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

function toVirtualPos(pos: number, addedCode: KitSnapshot['addedCode']) {
    let total = 0;
    for (const added of addedCode) {
        if (pos < added.originalPos) break;
        total += added.length;
    }
    return pos + total;
}

function toOriginalPos(pos: number, addedCode: KitSnapshot['addedCode']) {
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
