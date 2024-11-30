import assert from 'assert';
import path from 'path';
import sinon from 'sinon';
import ts from 'typescript';
import { RelativePattern } from 'vscode-languageserver-protocol';
import { Document } from '../../../src/lib/documents';
import { GlobalSnapshotsManager } from '../../../src/plugins/typescript/SnapshotManager';
import {
    LanguageServiceContainer,
    LanguageServiceDocumentContext,
    getService
} from '../../../src/plugins/typescript/service';
import { normalizePath, pathToUrl } from '../../../src/utils';
import { createVirtualTsSystem, getRandomVirtualDirPath } from './test-utils';

describe('service', () => {
    const testDir = path.join(__dirname, 'testfiles');

    function setup() {
        const virtualSystem = createVirtualTsSystem(testDir);

        const rootUris = [pathToUrl(testDir)];
        const lsDocumentContext: LanguageServiceDocumentContext = {
            isSvelteCheck: false,
            ambientTypesSource: 'svelte2tsx',
            createDocument(fileName, content) {
                return new Document(pathToUrl(fileName), content);
            },
            extendedConfigCache: new Map(),
            globalSnapshotsManager: new GlobalSnapshotsManager(virtualSystem),
            transformOnTemplateError: true,
            tsSystem: virtualSystem,
            watchTsConfig: false,
            notifyExceedSizeLimit: undefined,
            onProjectReloaded: undefined,
            projectService: undefined,
            nonRecursiveWatchPattern: undefined,
            watchDirectory: undefined,
            reportConfigError: undefined
        };

        return { virtualSystem, lsDocumentContext, rootUris };
    }

    it('can find tsconfig and override with default config', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
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

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
        );

        const ls = await getService(
            path.join(dirPath, 'random.svelte'),
            rootUris,
            lsDocumentContext
        );

        // ts internal
        delete ls.compilerOptions.configFilePath;

        assert.deepStrictEqual(ls.compilerOptions, <ts.CompilerOptions>{
            allowNonTsExtensions: true,
            checkJs: true,
            strict: true,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            target: ts.ScriptTarget.ESNext
        });
    });

    it('errors if tsconfig matches no svelte files', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        virtualSystem.readDirectory = () => [path.join(dirPath, 'random.ts')];

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                include: ['**/*.ts']
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
        );

        let called = false;
        await getService(path.join(dirPath, 'random.svelte'), rootUris, {
            ...lsDocumentContext,
            reportConfigError: (message) => {
                called = true;
                assert.equal(message.uri, pathToUrl(path.join(dirPath, 'tsconfig.json')));
            }
        });
        assert.ok(called);
    });

    it('does not report no svelte files when loaded through import', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        virtualSystem.readDirectory = () => [path.join(dirPath, 'random.ts')];

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                include: ['**/*.ts']
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script lang="ts">const a: number = null;</script>'
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.ts'),
            'import {} from "./random.svelte"'
        );

        let called = false;
        const service = await getService(path.join(dirPath, 'random.svelte'), rootUris, {
            ...lsDocumentContext,
            reportConfigError: (message) => {
                called = true;
                assert.deepStrictEqual([], message.diagnostics);
            }
        });

        assert.equal(
            normalizePath(path.join(dirPath, 'tsconfig.json')),
            normalizePath(service.tsconfigPath)
        );
        assert.ok(called);
    });

    it('does not errors if referenced tsconfig matches no svelte files', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        const tsPattern = '**/*.ts';
        const sveltePattern = '**/*.svelte';
        virtualSystem.readDirectory = (_path, _extensions, _excludes, include) => {
            return include?.[0] === tsPattern
                ? [path.join(dirPath, 'random.ts')]
                : include?.[0] === sveltePattern
                  ? [path.join(dirPath, 'random.svelte')]
                  : [];
        };

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                include: [],
                references: [{ path: './tsconfig_node.json' }, { path: './tsconfig_web.json' }]
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig_node.json'),
            JSON.stringify({
                include: [tsPattern]
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig_web.json'),
            JSON.stringify({
                include: [sveltePattern]
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
        );

        let called = false;
        const lsContainer = await getService(path.join(dirPath, 'random.svelte'), rootUris, {
            ...lsDocumentContext,
            reportConfigError: () => {
                called = true;
            }
        });

        assert.equal(
            normalizePath(path.join(dirPath, 'tsconfig_web.json')),
            lsContainer.tsconfigPath
        );
        assert.equal(called, false, 'expected not to call reportConfigError');
    });

    it('can loads default tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { lsDocumentContext, rootUris } = setup();

        const ls = await getService(
            path.join(dirPath, 'random.svelte'),
            rootUris,
            lsDocumentContext
        );

        assert.deepStrictEqual(ls.compilerOptions, <ts.CompilerOptions>{
            allowJs: true,
            allowSyntheticDefaultImports: true,
            allowNonTsExtensions: true,
            configFilePath: undefined,
            declaration: false,
            maxNodeModuleJsDepth: 2,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            noEmit: true,
            skipLibCheck: true,
            target: ts.ScriptTarget.ESNext
        });
    });

    it('patch release document so dispose do not throw', async () => {
        // testing this because the patch rely on ts implementation details
        // and we want to be aware of the changes

        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext'
                }
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
        );

        const ls = await getService(
            path.join(dirPath, 'random.svelte'),
            rootUris,
            lsDocumentContext
        );

        const document = new Document(pathToUrl(path.join(dirPath, 'random.svelte')), '');
        document.openedByClient = true;
        ls.updateSnapshot(document);

        const document2 = new Document(
            pathToUrl(path.join(dirPath, 'random2.svelte')),
            '<script>import Random from "./random.svelte";</script>'
        );
        document.openedByClient = true;
        ls.updateSnapshot(document2);

        const lang = ls.getService();

        lang.getProgram();

        // ensure updated document also works
        document2.update(' ', 0, 0);
        lang.getProgram();

        assert.doesNotThrow(() => {
            lang.dispose();
        });
    });

    function createReloadTester(
        docContext: LanguageServiceDocumentContext,
        testAfterReload: (reloadingConfigs: string[]) => Promise<boolean>
    ) {
        let _resolve: () => void;
        let _reject: (e: unknown) => void;
        const reloadPromise = new Promise<void>((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
        });

        return {
            docContextWithReload: {
                ...docContext,
                async onProjectReloaded(reloadingConfigs: string[]) {
                    try {
                        await testAfterReload(reloadingConfigs);
                        _resolve();
                    } catch (e) {
                        _reject(e);
                    }
                }
            },
            reloadPromise
        };
    }

    it('can watch tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
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

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
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

            return true;
        }
    });

    it('can watch extended tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();
        const tsconfigPath = path.join(dirPath, 'tsconfig.json');
        const extend = './.svelte-kit/tsconfig.json';
        const extendedConfigPathFull = path.resolve(path.dirname(tsconfigPath), extend);

        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                extends: extend
            })
        );

        virtualSystem.writeFile(
            path.join(dirPath, 'random.svelte'),
            '<script>const a: number = null;</script>'
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
            return true;
        }
    });

    it('can watch project reference tsconfig', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();
        const tsconfigPath = path.join(dirPath, 'tsconfig.json');
        const referenced = './tsconfig_node.json';
        const referencedConfigPathFull = path.resolve(path.dirname(tsconfigPath), referenced);

        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                references: [{ path: referenced }],
                include: []
            })
        );

        virtualSystem.writeFile(
            referencedConfigPathFull,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    strict: true
                },
                files: ['random.ts']
            })
        );

        const { reloadPromise, docContextWithReload } = createReloadTester(
            { ...lsDocumentContext, watchTsConfig: true },
            testAfterReload
        );

        const tsFilePath = path.join(dirPath, 'random.ts');
        virtualSystem.writeFile(tsFilePath, 'const a: number = null;');

        const ls = await getService(tsFilePath, rootUris, docContextWithReload);
        assert.deepStrictEqual(getSemanticDiagnosticsMessages(ls, tsFilePath), [
            "Type 'null' is not assignable to type 'number'."
        ]);

        virtualSystem.writeFile(
            referencedConfigPathFull,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    strict: false
                }
            })
        );

        await reloadPromise;

        async function testAfterReload(reloadingConfigs: string[]) {
            if (!reloadingConfigs.includes(referencedConfigPathFull)) {
                return false;
            }
            const newLs = await getService(tsFilePath, rootUris, {
                ...lsDocumentContext,
                watchTsConfig: true
            });

            assert.deepStrictEqual(getSemanticDiagnosticsMessages(newLs, tsFilePath), []);
            return true;
        }
    });

    it('can open client file that do not exist in fs', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { lsDocumentContext, rootUris } = setup();

        // don't need tsconfig because files doesn't exist in fs goes to a service with default config
        const ls = await getService(
            path.join(dirPath, 'random.svelte'),
            rootUris,
            lsDocumentContext
        );

        const document = new Document(pathToUrl(path.join(dirPath, 'random.ts')), '');
        document.openedByClient = true;
        ls.updateSnapshot(document);

        assert.doesNotThrow(() => {
            ls.getService().getSemanticDiagnostics(document.getFilePath()!);
        });
    });

    it('resolve module with source project reference redirect', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        const package1 = path.join(dirPath, 'package1');

        virtualSystem.writeFile(
            path.join(package1, 'tsconfig.json'),
            JSON.stringify({
                references: [{ path: '../package2' }],
                files: ['index.ts']
            })
        );

        const package2 = path.join(dirPath, 'package2');
        virtualSystem.writeFile(
            path.join(package2, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    composite: true,
                    strict: true
                },
                files: ['index.ts']
            })
        );

        const importing = path.join(package1, 'index.ts');
        virtualSystem.writeFile(importing, 'import { hi } from "package2"; hi((a) => `${a}`);');

        const imported = path.join(package2, 'index.ts');
        virtualSystem.writeFile(imported, 'export function hi(cb: (num: number) => string) {}');

        const package2Link = normalizePath(path.join(package1, 'node_modules', 'package2'));
        virtualSystem.realpath = (p) => {
            if (normalizePath(p).startsWith(package2Link)) {
                const sub = p.substring(package2Link.length);
                return path.join(package2) + sub;
            }

            return p;
        };

        const fileExists = virtualSystem.fileExists;
        virtualSystem.fileExists = (p) => {
            const realPath = virtualSystem.realpath!(p);

            return fileExists(realPath);
        };

        const ls = await getService(importing, rootUris, lsDocumentContext);

        assert.deepStrictEqual(getSemanticDiagnosticsMessages(ls, importing), []);
    });

    it('skip directory watching if directory is root', async () => {
        const dirPath = getRandomVirtualDirPath(path.join(testDir, 'Test'));
        const { virtualSystem, lsDocumentContext } = setup();

        const rootUris = [pathToUrl(dirPath)];

        const watchDirectory = sinon.spy();
        lsDocumentContext.watchDirectory = watchDirectory;
        lsDocumentContext.nonRecursiveWatchPattern = '*.ts';

        virtualSystem.readDirectory = () => [];
        virtualSystem.directoryExists = () => true;

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {},
                include: ['src/**/*.ts', 'test/**/*.ts', '../foo/**/*.ts']
            })
        );

        await getService(path.join(dirPath, 'random.svelte'), rootUris, lsDocumentContext);

        sinon.assert.calledWith(watchDirectory.firstCall, <RelativePattern[]>[
            {
                baseUri: pathToUrl(path.join(dirPath, '../foo')),
                pattern: '**/*.ts'
            }
        ]);
    });

    it('skip directory watching if directory do not exist', async () => {
        const dirPath = getRandomVirtualDirPath(path.join(testDir, 'Test'));
        const { virtualSystem, lsDocumentContext } = setup();

        const rootUris = [pathToUrl(dirPath)];

        const watchDirectory = sinon.spy();
        lsDocumentContext.watchDirectory = watchDirectory;
        lsDocumentContext.nonRecursiveWatchPattern = '*.ts';

        virtualSystem.readDirectory = () => [];
        virtualSystem.directoryExists = () => false;

        virtualSystem.writeFile(
            path.join(dirPath, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {},
                include: ['../test/**/*.ts']
            })
        );

        await getService(path.join(dirPath, 'random.svelte'), rootUris, lsDocumentContext);

        sinon.assert.calledWith(watchDirectory.firstCall, <RelativePattern[]>[]);
    });

    it('assigns files to service with the file in the program', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        const tsconfigPath = path.join(dirPath, 'tsconfig.json');
        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                compilerOptions: <ts.CompilerOptions>{
                    noImplicitOverride: true
                },
                include: ['src/*.ts']
            })
        );

        const referencedFile = path.join(dirPath, 'anotherPackage', 'index.svelte');
        const tsFilePath = path.join(dirPath, 'src', 'random.ts');

        virtualSystem.readDirectory = () => [tsFilePath];
        virtualSystem.writeFile(
            referencedFile,
            '<script lang="ts">class A { a =1 }; class B extends A { a =2 };</script>'
        );
        virtualSystem.writeFile(tsFilePath, 'import "../anotherPackage/index.svelte";');

        const document = new Document(
            pathToUrl(referencedFile),
            virtualSystem.readFile(referencedFile)!
        );
        document.openedByClient = true;
        const ls = await getService(referencedFile, rootUris, lsDocumentContext);
        ls.updateSnapshot(document);

        assert.equal(normalizePath(ls.tsconfigPath), normalizePath(tsconfigPath));

        const noImplicitOverrideErrorCode = 4114;
        const findError = (ls: LanguageServiceContainer) =>
            ls
                .getService()
                .getSemanticDiagnostics(referencedFile)
                .find((f) => f.code === noImplicitOverrideErrorCode);

        assert.ok(findError(ls));

        virtualSystem.writeFile(tsFilePath, '');
        ls.updateTsOrJsFile(tsFilePath);

        const ls2 = await getService(referencedFile, rootUris, lsDocumentContext);
        ls2.updateSnapshot(document);

        assert.deepStrictEqual(findError(ls2), undefined);
    });

    it('assigns newly created files to the right service before the watcher trigger', async () => {
        const dirPath = getRandomVirtualDirPath(testDir);
        const { virtualSystem, lsDocumentContext, rootUris } = setup();

        const tsconfigPath = path.join(dirPath, 'tsconfig.json');
        virtualSystem.writeFile(
            tsconfigPath,
            JSON.stringify({
                compilerOptions: {}
            })
        );

        const svelteFilePath = path.join(dirPath, 'random.svelte');

        virtualSystem.writeFile(svelteFilePath, '');

        const ls = await getService(svelteFilePath, rootUris, lsDocumentContext);

        assert.equal(normalizePath(ls.tsconfigPath), normalizePath(tsconfigPath));

        const svelteFilePath2 = path.join(dirPath, 'random2.svelte');
        virtualSystem.writeFile(svelteFilePath2, '');

        const ls2 = await getService(svelteFilePath2, rootUris, lsDocumentContext);
        assert.equal(normalizePath(ls2.tsconfigPath), normalizePath(tsconfigPath));
    });

    function getSemanticDiagnosticsMessages(ls: LanguageServiceContainer, filePath: string) {
        return ls
            .getService()
            .getSemanticDiagnostics(filePath)
            .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    }
});
