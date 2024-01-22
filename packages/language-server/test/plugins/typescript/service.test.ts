import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../src/lib/documents';
import {
    getService,
    LanguageServiceDocumentContext
} from '../../../src/plugins/typescript/service';
import { GlobalSnapshotsManager } from '../../../src/plugins/typescript/SnapshotManager';
import { pathToUrl } from '../../../src/utils';
import { createVirtualTsSystem, getRandomVirtualDirPath } from './test-utils';
import { createProjectService } from '../../../src/plugins/typescript/serviceCache';
import { LSConfigManager } from '../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../src/plugins';

describe('service', () => {
    const testDir = path.join(__dirname, 'testfiles');
    const serviceTestDir = path.join(testDir, 'services');

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
            onProjectReloaded: undefined,
            projectService: undefined
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

    it('resolve module with the compilerOptions from project reference', async () => {
        // Don't test this with module not found diagnostics
        // because there is a case where is won't have an error but still not resolved the module

        const { lsAndTsDocResolver, docManager } = setupRealFS();
        const pathsProjectRefDir = path.join(serviceTestDir, 'project-reference', 'paths');

        const importingFilePath = path.join(pathsProjectRefDir, 'importing.svelte');
        const document = docManager.openClientDocument({
            uri: pathToUrl(importingFilePath),
            text: ts.sys.readFile(importingFilePath) || ''
        });

        const lsContainer = await lsAndTsDocResolver.getTSService(importingFilePath);
        lsContainer.getService();
        const snapshotManager = lsContainer.snapshotManager;

        const importedFilePath = path.join(pathsProjectRefDir, 'imported.ts');
        assert.equal(
            snapshotManager.get(importedFilePath),
            undefined,
            'expected to load imported file through module resolution'
        );

        // uncomment the import
        document.update(
            '',
            document.offsetAt({
                line: 2,
                character: 0
            }),
            document.offsetAt({
                line: 2,
                character: 2
            })
        );
        lsContainer.updateSnapshot(document);
        lsContainer.getService();

        assert.ok(snapshotManager.get(importedFilePath));
    });

    function setupRealFS() {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsConfigManager = new LSConfigManager();
        const workspaceUris = [pathToUrl(serviceTestDir)];
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            workspaceUris,
            lsConfigManager
        );

        return { lsAndTsDocResolver, docManager };
    }
});
