import assert from 'assert';
import path from 'path';
import sinon from 'sinon';
import ts from 'typescript';
import { RelativePattern } from 'vscode-languageserver-protocol';
import { Document } from '../../../src/lib/documents';
import { GlobalSnapshotsManager } from '../../../src/plugins/typescript/SnapshotManager';
import {
    LanguageServiceDocumentContext,
    getService
} from '../../../src/plugins/typescript/service';
import { normalizePath, pathToUrl } from '../../../src/utils';
import { createVirtualTsSystem, getRandomVirtualDirPath } from './test-utils';

describe('service', () => {
    const testDir = path.join(__dirname, 'testfiles');
    const serviceTestDir = path.join(testDir, 'services');

    function setup() {
        const virtualSystem = createVirtualTsSystem(testDir);

        const rootUris = [pathToUrl(testDir)];
        const lsDocumentContext: LanguageServiceDocumentContext = {
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
            watchDirectory: undefined
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
        const dirPath = getRandomVirtualDirPath(testDir);
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

    it('can open client file that do not exist in fs', async () => {
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
        virtualSystem.writeFile(
            importing,
            'import { hi } from "package2"; hi((a) => `${a}`);'
        );

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
        }

        const ls = await getService(
            path.join(package1, 'DoNotMatter.svelte'),
            rootUris,
            lsDocumentContext
        );

        const service = ls.getService();
        assert.deepStrictEqual(
            [],
            service.getSemanticDiagnostics(importing).map((d) => d.messageText)
        );
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
});
