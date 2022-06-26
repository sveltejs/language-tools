import path from 'path';
import assert from 'assert';
import ts, { FileWatcherEventKind } from 'typescript';
import { Document } from '../../../src/lib/documents';
import {
    getService,
    LanguageServiceDocumentContext
} from '../../../src/plugins/typescript/service';
import { GlobalSnapshotsManager } from '../../../src/plugins/typescript/SnapshotManager';
import { normalizePath, pathToUrl } from '../../../src/utils';

describe('service', () => {
    const testDir = path.join(__dirname, 'testfiles');

    function setup() {
        const virtualFs = new Map<string, string>();
        // array behave more similar to the actual fs event than Set
        const watchers = new Map<string, ts.FileWatcherCallback[]>();
        const watchTimeout = new Map<string, Array<ReturnType<typeof setTimeout>>>();

        const virtualSystem: ts.System = {
            ...ts.sys,
            writeFile(path, data) {
                const normalizedPath = normalizePath(path);
                const existsBefore = virtualFs.has(normalizedPath);
                virtualFs.set(normalizedPath, data);
                triggerWatch(
                    normalizedPath,
                    existsBefore ? ts.FileWatcherEventKind.Changed : ts.FileWatcherEventKind.Created
                );
            },
            readFile(path) {
                return virtualFs.get(normalizePath(path));
            },
            fileExists(path) {
                return virtualFs.has(normalizePath(path));
            },
            deleteFile(path) {
                const normalizedPath = normalizePath(path);
                const existsBefore = virtualFs.has(normalizedPath);
                virtualFs.delete(normalizedPath);

                if (existsBefore) {
                    triggerWatch(normalizedPath, ts.FileWatcherEventKind.Deleted);
                }
            },
            watchFile(path, callback) {
                const normalizedPath = normalizePath(path);
                let watchersOfPath = watchers.get(normalizedPath);

                if (!watchersOfPath) {
                    watchersOfPath = [];
                    watchers.set(normalizedPath, watchersOfPath);
                }

                watchersOfPath.push(callback);

                return {
                    close() {
                        const watchersOfPath = watchers.get(normalizedPath);

                        if (watchersOfPath) {
                            watchers.set(
                                normalizedPath,
                                watchersOfPath.filter((watcher) => watcher === callback)
                            );
                        }

                        const timeouts = watchTimeout.get(normalizedPath);

                        if (timeouts != null) {
                            timeouts.forEach((timeout) => clearTimeout(timeout));
                        }
                    }
                };
            }
        };

        const lsDocumentContext: LanguageServiceDocumentContext = {
            ambientTypesSource: 'svelte2tsx',
            createDocument(fileName, content) {
                return new Document(pathToUrl(fileName), content);
            },
            extendedConfigCache: new Map(),
            globalSnapshotsManager: new GlobalSnapshotsManager(),
            transformOnTemplateError: true,
            tsSystem: virtualSystem,
            useNewTransformation: true,
            watchTsConfig: false,
            notifyExceedSizeLimit: undefined,
            onProjectReloaded: undefined
        };

        const rootUris = [pathToUrl(testDir)];

        return { virtualSystem, lsDocumentContext, rootUris };

        function triggerWatch(normalizedPath: string, kind: FileWatcherEventKind) {
            let timeoutsOfPath = watchTimeout.get(normalizedPath);

            if (!timeoutsOfPath) {
                timeoutsOfPath = [];
                watchTimeout.set(normalizedPath, timeoutsOfPath);
            }

            timeoutsOfPath.push(
                setTimeout(
                    () =>
                        watchers
                            .get(normalizedPath)
                            ?.forEach((callback) => callback(normalizedPath, kind)),
                    0
                )
            );
        }
    }

    function getRandomVirtualDirPath() {
        return path.join(testDir, `virtual-path-${Math.floor(Math.random() * 100_000)}`);
    }

    it('can find tsconfig and override with default config', async () => {
        const dirPath = getRandomVirtualDirPath();
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    checkJs: true,
                    strict: true
                }
            })
        );

        const ls = await getService(
            path.join(dirPath, 'random.svelte'),
            rootUris,
            lsDocumentContext
        );

        // ts internal
        delete ls.compilerOptions.configFilePath;

        assert.deepStrictEqual(ls.compilerOptions, <ts.CompilerOptions>{
            allowJs: true,
            allowNonTsExtensions: true,
            checkJs: true,
            strict: true,
            declaration: false,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            noEmit: true,
            skipLibCheck: true,
            target: ts.ScriptTarget.ESNext
        });
    });

    function createReloadTester(
        docContext: LanguageServiceDocumentContext,
        testAfterReload: () => Promise<void>
    ) {
        let _resolve: () => void;
        const reloadPromise = new Promise<void>((resolve) => {
            _resolve = resolve;
        });

        return {
            docContextWithReload: {
                ...docContext,
                async onProjectReloaded() {
                    try {
                        await testAfterReload();
                    } finally {
                        _resolve();
                    }
                }
            },
            reloadPromise
        };
    }

    it('can watch tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath();
        const { virtualSystem, lsDocumentContext, rootUris } = setup();
        const tsconfigPath = path.join(dirPath, 'tsconfig.json');

        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    strict: false
                }
            })
        );

        const { reloadPromise, docContextWithReload } = createReloadTester(
            { ...lsDocumentContext, watchTsConfig: true },
            testAfterReload
        );

        await getService(path.join(dirPath, 'random.svelte'), rootUris, docContextWithReload);

        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    strict: true
                }
            })
        );

        await reloadPromise;

        async function testAfterReload() {
            const newLs = await getService(path.join(dirPath, 'random.svelte'), rootUris, {
                ...lsDocumentContext,
                watchTsConfig: true
            });
            assert.strictEqual(
                newLs.compilerOptions.strict,
                true,
                'expected to reload compilerOptions'
            );
        }
    });

    it('can watch extended tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath();
        const { virtualSystem, lsDocumentContext, rootUris } = setup();
        const tsconfigPath = path.join(dirPath, 'tsconfig.json');
        const extend = './.svelte-kit/tsconfig.json';
        const extendedConfigPathFull = path.resolve(tsconfigPath, extend);

        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                extends: extend
            })
        );

        const { reloadPromise, docContextWithReload } = createReloadTester(
            { ...lsDocumentContext, watchTsConfig: true },
            testAfterReload
        );

        await getService(path.join(dirPath, 'random.svelte'), rootUris, docContextWithReload);

        virtualSystem.writeFile(
            extendedConfigPathFull,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    strict: true
                }
            })
        );

        await reloadPromise;

        async function testAfterReload() {
            const newLs = await getService(path.join(dirPath, 'random.svelte'), rootUris, {
                ...lsDocumentContext,
                watchTsConfig: true
            });
            assert.strictEqual(
                newLs.compilerOptions.strict,
                true,
                'expected to reload compilerOptions'
            );
        }
    });
});
