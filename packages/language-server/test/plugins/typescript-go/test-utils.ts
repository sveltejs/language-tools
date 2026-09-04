import path from 'path';
import { TsLSPService } from './lspService';
import { pathToUrl } from '../../../src/utils';
import { existsSync, readdirSync, statSync } from 'fs';
import { VERSION } from 'svelte/compiler';
import { Document, DocumentManager } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

let tsserverPath: string | undefined;
const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

export interface TsGoServiceSetupResult {
    service: TsLSPService;
    docManager: DocumentManager;
    lsConfigManager: LSConfigManager;
}

export async function createTsGoServiceForTest(
    workspaceDir: string,
    capabilities?: ClientCapabilities
): Promise<TsGoServiceSetupResult> {
    if (!tsserverPath) {
        const pkgPath = require.resolve('@typescript/native/package.json');

        const getExePathModule = await import(
            pathToUrl(path.join(path.dirname(pkgPath), 'lib', 'getExePath.js'))
        );
        tsserverPath = getExePathModule.default() as string;
    }

    const docManager = new DocumentManager((textDocument) =>
        Document.createForTest(textDocument.uri, textDocument.text)
    );
    const lsConfigManager = new LSConfigManager();
    if (capabilities) {
        lsConfigManager.updateClientCapabilities(capabilities);
    }

    const service = new TsLSPService({
        docManager: docManager,
        lsConfigManager: lsConfigManager,
        tsserverPath: tsserverPath,
        serverInitializationOptions: {
            workspaceFolders: [{ name: '', uri: pathToUrl(workspaceDir) }],
            capabilities
        }
    });
    await service.start();
    return { service, docManager, lsConfigManager };
}

export function setupSharedServices(
    workspaceDir: string,
    {
        capabilities
    }: {
        capabilities?: ClientCapabilities;
    } = {}
) {
    let services: TsGoServiceSetupResult;
    before(async () => {
        const result = await createTsGoServiceForTest(workspaceDir, capabilities);
        services = result;
    });
    after(async () => {
        services?.service.dispose();
    });

    return getServices;

    function getServices() {
        return services;
    }
}

export function createSnapshotTesterForTsGo<
    TestOptions extends {
        dir: string;
        workspaceDir: string;
        context: Mocha.Suite;
    }
>(
    executeTest: (
        inputFile: string,
        testOptions: TestOptions,
        services: TsGoServiceSetupResult
    ) => Promise<void>,
    capabilities?: ClientCapabilities
) {
    return async (testOptions: TestOptions) => {
        const getOrCreateServices = setupSharedServices(testOptions.workspaceDir, {
            capabilities
        });
        executeTests(testOptions, getOrCreateServices);
    };

    function executeTests(testOptions: TestOptions, getServices: () => TsGoServiceSetupResult) {
        const { dir } = testOptions;

        const inputFile = path.join(dir, 'input.svelte');

        if (existsSync(inputFile)) {
            const _it =
                dir.endsWith('.v5') && !isSvelte5Plus
                    ? it.skip
                    : dir.endsWith('.only')
                      ? it.only
                      : it;
            _it(dir.substring(__dirname.length), async () => {
                const services = getServices();
                await executeTest(inputFile, testOptions, services);
            });
        } else {
            const _describe = dir.endsWith('.only') ? describe.only : describe;
            _describe(dir.substring(__dirname.length), function () {
                const subDirs = readdirSync(dir);

                for (const subDir of subDirs) {
                    const stat = statSync(path.join(dir, subDir));
                    if (stat.isDirectory()) {
                        executeTests(
                            {
                                ...testOptions,
                                context: this,
                                dir: path.join(dir, subDir)
                            },
                            getServices
                        );
                    }
                }
            });
        }
    }
}

export function setupSkip(it: typeof globalThis.it, skips: string[]): typeof globalThis.it {
    return Object.assign(resultFn, {
        skip: it.skip,
        only: it.only,
        retries: it.retries
    });

    function resultFn(fn: Mocha.Func): Mocha.Test;
    function resultFn(name: string, fn?: Mocha.Func): Mocha.Test;
    function resultFn(nameOrFn: string | Mocha.Func, fn?: Mocha.Func) {
        if (typeof nameOrFn === 'string') {
            if (skips.includes(nameOrFn)) {
                return it.skip(nameOrFn, fn!);
            }
            return it(nameOrFn, fn!);
        } else {
            if (skips.includes(nameOrFn.name)) {
                return it.skip(nameOrFn);
            }
            return it(nameOrFn);
        }
    }
}
