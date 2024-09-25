import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { getProjectDirectory, hasNodeModule } from '../utils';
import { InternalHelpers, internalHelpers } from 'svelte2tsx';
type _ts = typeof ts;

interface KitSnapshot {
    file: ts.IScriptSnapshot;
    version: string;
    addedCode: InternalHelpers.AddedCode[];
}

declare module 'typescript/lib/tsserverlibrary' {
    interface LanguageServiceHost {
        /** @internal */ getCachedExportInfoMap?(): unknown;
        /** @internal */ getModuleSpecifierCache?(): unknown;
        /** @internal */ getGlobalTypingsCacheLocation?(): string | undefined;
        /** @internal */ getSymlinkCache?(files: readonly ts.SourceFile[]): unknown;
        /** @internal */ getPackageJsonsVisibleToFile?(
            fileName: string,
            rootDir?: string
        ): readonly unknown[];
        /** @internal */ getPackageJsonAutoImportProvider?(): ts.Program | undefined;

        /** @internal*/ getModuleResolutionCache?(): ts.ModuleResolutionCache;
    }
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
                text: "'never' | 'always' | 'ignore'",
                kind: 'stringLiteral'
            }
        ],
        documentation: [
            {
                text: 'Control how SvelteKit should handle trailing slashes in the URL. More info: https://kit.svelte.dev/docs/page-options#trailingslash',
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
    entries: {
        allowedIn: ['api', 'page', 'server', 'universal'],
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
                text: 'entries',
                kind: 'functionName'
            },
            {
                text: '() {}',
                kind: 'punctuation'
            }
        ],
        documentation: [
            {
                text:
                    'Generate values for dynamic parameters in prerendered pages.\n' +
                    'More info: https://kit.svelte.dev/docs/page-options#entries',
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
    HEAD: createApiExport('HEAD'),
    fallback: createApiExport('fallback'),
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
    },
    reroute: {
        allowedIn: [],
        displayParts: [],
        documentation: [
            {
                text:
                    `This function allows you to change how URLs are translated into routes. ` +
                    `The returned pathname (which defaults to url.pathname) is used to select the route and its parameters. ` +
                    `More info: https://kit.svelte.dev/docs/hooks#universal-hooks-reroute`,
                kind: 'text'
            }
        ]
    }
};

const FORCE_UPDATE_VERSION = 'FORCE_UPDATE_VERSION';

export function isKitRouteExportAllowedIn(
    basename: string,
    kitExport: (typeof kitExports)[keyof typeof kitExports]
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

const kitFilesSettings: InternalHelpers.KitFilesSettings = {
    paramsPath: 'src/params',
    clientHooksPath: 'src/hooks.client',
    serverHooksPath: 'src/hooks.server',
    universalHooksPath: 'src/hooks'
};

function getProxiedLanguageService(info: ts.server.PluginCreateInfo, ts: _ts, logger?: Logger) {
    const cachedProxiedLanguageService = cache.get(info);
    if (cachedProxiedLanguageService !== undefined) {
        return cachedProxiedLanguageService ?? undefined;
    }

    const projectDirectory = getProjectDirectory(info.project);
    if (projectDirectory && !hasNodeModule(projectDirectory, '@sveltejs/kit')) {
        // Not a SvelteKit project, do nothing
        cache.set(info, null);
        return;
    }

    const originalLanguageServiceHost = info.languageServiceHost;

    class ProxiedLanguageServiceHost implements ts.LanguageServiceHost {
        private files: Record<string, KitSnapshot> = {};

        constructor() {
            // This never worked due to configPath being the wrong format and due to https://github.com/microsoft/TypeScript/issues/43329 .
            // Noone has complained about this not working, so this is commented out for now, revisit if it ever comes up.
            // const configPath = info.project.getCurrentDirectory() + '/svelte.config.js';
            // (import(configPath)) as Promise<any>)
            //     .then((module) => {
            //         const config = module.default;
            //         if (config.kit && config.kit.files) {
            //             if (config.kit.files.params) {
            //                 this.paramsPath = config.kit.files.params;
            //             }
            //             if (config.kit.files.hooks) {
            //                 this.serverHooksPath ||= config.kit.files.hooks.server;
            //                 this.clientHooksPath ||= config.kit.files.hooks.client;
            //                 this.universalHooksPath ||= config.kit.files.hooks.universal;
            //             }
            //             logger?.log(
            //                 `Using SvelteKit files config: ${JSON.stringify(
            //                     config.kit.files.hooks
            //                 )}`
            //             );
            //             // We could be more sophisticated with only removing the files that are actually
            //             // wrong but this is good enough given how rare it is that this setting is used
            //             Object.keys(this.files)
            //                 .filter((name) => {
            //                     return !name.includes('src/hooks') && !name.includes('src/params');
            //                 })
            //                 .forEach((name) => {
            //                     delete this.files[name];
            //                 });
            //         }
            //     })
            //     .catch((e) => {
            //         logger?.log('error loading SvelteKit file', e);
            //     });
        }

        log() {}

        trace() {}

        error() {}

        getCompilationSettings() {
            return originalLanguageServiceHost.getCompilationSettings();
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
            const scriptVersion = this.getScriptVersion(fileName);
            if (
                !this.files[fileName] ||
                scriptVersion !== originalLanguageServiceHost.getScriptVersion(fileName) ||
                scriptVersion === FORCE_UPDATE_VERSION
            ) {
                return undefined;
            }
            return this.files[fileName];
        }

        upsertKitFile(fileName: string) {
            const result = internalHelpers.upsertKitFile(ts, fileName, kitFilesSettings, () =>
                info.languageService.getProgram()?.getSourceFile(fileName)
            );
            if (!result) {
                return;
            }

            const { text, addedCode } = result;
            const snap = ts.ScriptSnapshot.fromString(text);
            snap.getChangeRange = (_) => undefined;

            // If this is a new file, typescript might have cached the unpatched version
            // It won't update even if we return the patched version in getScriptSnapshot, so we force an update
            // This should only happen to files that are opened by the client after the first compilation of the proxy language service
            // and won't happen if there are any updates to the file afterwards
            this.files[fileName] = {
                version:
                    this.files[fileName] === undefined
                        ? FORCE_UPDATE_VERSION
                        : originalLanguageServiceHost.getScriptVersion(fileName),
                file: snap,
                addedCode
            };
            return this.files[fileName];
        }

        // needed for path auto completions
        readDirectory = originalLanguageServiceHost.readDirectory
            ? (...args: Parameters<NonNullable<ts.LanguageServiceHost['readDirectory']>>) => {
                  return originalLanguageServiceHost.readDirectory!(...args);
              }
            : undefined;

        getDirectories = originalLanguageServiceHost.getDirectories
            ? (...args: Parameters<NonNullable<ts.LanguageServiceHost['getDirectories']>>) => {
                  return originalLanguageServiceHost.getDirectories!(...args);
              }
            : undefined;

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

        getCancellationToken = originalLanguageServiceHost.getCancellationToken
            ? () => originalLanguageServiceHost.getCancellationToken!()
            : undefined;

        getNewLine = originalLanguageServiceHost.getNewLine
            ? () => originalLanguageServiceHost.getNewLine!()
            : undefined;

        useCaseSensitiveFileNames = originalLanguageServiceHost.useCaseSensitiveFileNames
            ? () => originalLanguageServiceHost.useCaseSensitiveFileNames!()
            : undefined;

        realpath = originalLanguageServiceHost.realpath
            ? (...args: Parameters<NonNullable<ts.LanguageServiceHost['realpath']>>) =>
                  originalLanguageServiceHost.realpath!(...args)
            : undefined;

        getProjectReferences = originalLanguageServiceHost.getProjectReferences
            ? () => originalLanguageServiceHost.getProjectReferences!()
            : undefined;

        getParsedCommandLine = originalLanguageServiceHost.getParsedCommandLine
            ? (fileName: string) => originalLanguageServiceHost.getParsedCommandLine!(fileName)
            : undefined;

        getCachedExportInfoMap = originalLanguageServiceHost.getCachedExportInfoMap
            ? () => originalLanguageServiceHost.getCachedExportInfoMap!()
            : undefined;

        getModuleSpecifierCache = originalLanguageServiceHost.getModuleSpecifierCache
            ? () => originalLanguageServiceHost.getModuleSpecifierCache!()
            : undefined;

        getGlobalTypingsCacheLocation = originalLanguageServiceHost.getGlobalTypingsCacheLocation
            ? () => originalLanguageServiceHost.getGlobalTypingsCacheLocation!()
            : undefined;

        getSymlinkCache = originalLanguageServiceHost.getSymlinkCache
            ? (...args: any[]) =>
                  originalLanguageServiceHost.getSymlinkCache!(
                      // @ts-ignore
                      ...args
                  )
            : undefined;

        getPackageJsonsVisibleToFile = originalLanguageServiceHost.getPackageJsonsVisibleToFile
            ? (...args: any[]) =>
                  originalLanguageServiceHost.getPackageJsonsVisibleToFile!(
                      // @ts-ignore
                      ...args
                  )
            : undefined;

        getPackageJsonAutoImportProvider =
            originalLanguageServiceHost.getPackageJsonAutoImportProvider
                ? () => originalLanguageServiceHost.getPackageJsonAutoImportProvider!()
                : undefined;

        getModuleResolutionCache = originalLanguageServiceHost.getModuleResolutionCache
            ? () => originalLanguageServiceHost.getModuleResolutionCache!()
            : undefined;
    }

    // Ideally we'd create a full Proxy of the language service, but that seems to have cache issues
    // with diagnostics, which makes positions go out of sync.
    const languageServiceHost = new ProxiedLanguageServiceHost();
    const languageService = ts.createLanguageService(
        languageServiceHost,
        createProxyRegistry(ts, originalLanguageServiceHost, kitFilesSettings)
    );
    cache.set(info, { languageService, languageServiceHost });
    return {
        languageService,
        languageServiceHost
    };
}

function createProxyRegistry(
    ts: _ts,
    originalLanguageServiceHost: ts.LanguageServiceHost,
    options: InternalHelpers.KitFilesSettings
) {
    // Don't destructure options param, as the value may be mutated through a svelte.config.js later
    const registry = ts.createDocumentRegistry();
    return registry;
    // TODO check why this fails on linux and reenable later
    // const originalRegistry = (originalLanguageServiceHost as any).documentRegistry;
    // const proxyRegistry: ts.DocumentRegistry = {
    //     ...originalRegistry,
    //     acquireDocumentWithKey(
    //         fileName,
    //         tsPath,
    //         compilationSettingsOrHost,
    //         key,
    //         scriptSnapshot,
    //         version,
    //         scriptKind,
    //         sourceFileOptions
    //     ) {
    //         if (internalHelpers.isKitFile(fileName, options)) {
    //             return registry.acquireDocumentWithKey(
    //                 fileName,
    //                 tsPath,
    //                 compilationSettingsOrHost,
    //                 key,
    //                 scriptSnapshot,
    //                 version,
    //                 scriptKind,
    //                 sourceFileOptions
    //             );
    //         }

    //         return originalRegistry.acquireDocumentWithKey(
    //             fileName,
    //             tsPath,
    //             compilationSettingsOrHost,
    //             key,
    //             scriptSnapshot,
    //             version,
    //             scriptKind,
    //             sourceFileOptions
    //         );
    //     },
    //     updateDocumentWithKey(
    //         fileName,
    //         tsPath,
    //         compilationSettingsOrHost,
    //         key,
    //         scriptSnapshot,
    //         version,
    //         scriptKind,
    //         sourceFileOptions
    //     ) {
    //         if (internalHelpers.isKitFile(fileName, options)) {
    //             return registry.updateDocumentWithKey(
    //                 fileName,
    //                 tsPath,
    //                 compilationSettingsOrHost,
    //                 key,
    //                 scriptSnapshot,
    //                 version,
    //                 scriptKind,
    //                 sourceFileOptions
    //             );
    //         }

    //         return originalRegistry.updateDocumentWithKey(
    //             fileName,
    //             tsPath,
    //             compilationSettingsOrHost,
    //             key,
    //             scriptSnapshot,
    //             version,
    //             scriptKind,
    //             sourceFileOptions
    //         );
    //     }
    // };

    // return proxyRegistry;
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
            toVirtualPos: (pos: number) => internalHelpers.toVirtualPos(pos, result.addedCode),
            toOriginalPos: (pos: number) => internalHelpers.toOriginalPos(pos, result.addedCode)
        };
    }
}
