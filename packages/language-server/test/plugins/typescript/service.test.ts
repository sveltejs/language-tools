import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { Document } from '../../../src/lib/documents';
import {
    getService,
    LanguageServiceDocumentContext
} from '../../../src/plugins/typescript/service';
import { GlobalSnapshotsManager } from '../../../src/plugins/typescript/SnapshotManager';
import { pathToUrl } from '../../../src/utils';
import { createVirtualTsSystem, getRandomVirtualDirPath } from './test-utils';

describe('service', () => {
    const testDir = path.join(__dirname, 'testfiles');

    function setup() {
        const virtualSystem = createVirtualTsSystem(testDir);

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
            onProjectReloaded: undefined
        };

        const rootUris = [pathToUrl(testDir)];

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
});
