import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import * as svS from '../../../src/plugins/typescript/svelte-sys';
import { DocumentSnapshot } from '../../../src/plugins/typescript/DocumentSnapshot';
import { createSvelteModuleLoader } from '../../../src/plugins/typescript/module-loader';

describe('createSvelteModuleLoader', () => {
    afterEach(() => {
        sinon.restore();
    });

    function setup(resolvedModule: ts.ResolvedModuleFull) {
        const getSvelteSnapshotStub = sinon
            .stub()
            .returns(<Partial<DocumentSnapshot>>{ scriptKind: ts.ScriptKind.JSX });

        const resolveStub = sinon.stub().returns(<ts.ResolvedModuleWithFailedLookupLocations>{
            resolvedModule
        });
        const moduleCacheMock = <ts.ModuleResolutionCache>{
            getPackageJsonInfoCache: () => ({})
        };
        const moduleResolutionHost = { ...ts.sys };

        const svelteSys = {
            ...svS.createSvelteSys(ts.sys)
        };
        sinon.stub(svS, 'createSvelteSys').returns(svelteSys);

        const compilerOptions: ts.CompilerOptions = { strict: true, paths: { '/@/*': [] } };
        const moduleResolver = createSvelteModuleLoader(
            getSvelteSnapshotStub,
            compilerOptions,
            ts.sys,
            {
                ...ts,
                createModuleResolutionCache: () => moduleCacheMock,
                resolveModuleName: resolveStub
            },
            () => moduleResolutionHost
        );

        return {
            getSvelteSnapshotStub,
            moduleCacheMock: moduleCacheMock,
            resolveStub,
            compilerOptions,
            moduleResolver,
            svelteSys,
            moduleResolutionHost
        };
    }

    function lastCall(stub: sinon.SinonStub<any[], any>) {
        return stub.getCall(stub.getCalls().length - 1);
    }

    it('uses svelte script kind if resolved module is svelte file', async () => {
        const resolvedModule: ts.ResolvedModuleFull = {
            extension: ts.Extension.Ts,
            resolvedFileName: 'filename.d.svelte.ts'
        };
        const { getSvelteSnapshotStub, moduleResolver, svelteSys } = setup(resolvedModule);

        svelteSys.getRealSveltePathIfExists = (filename: string) =>
            filename === 'filename.d.svelte.ts' ? 'filename.svelte' : filename;

        const result = moduleResolver.resolveModuleNames(
            ['./normal.ts'],
            'C:/somerepo/somefile.svelte',
            undefined,
            undefined,
            undefined as any
        );

        assert.deepStrictEqual(result, [
            <ts.ResolvedModuleFull>{
                extension: ts.Extension.Jsx,
                resolvedFileName: 'filename.svelte',
                isExternalLibraryImport: undefined
            }
        ]);
        assert.deepStrictEqual(lastCall(getSvelteSnapshotStub).args, ['filename.svelte']);
    });

    it('uses cache if module was already resolved before', async () => {
        const resolvedModule: ts.ResolvedModuleFull = {
            extension: ts.Extension.Ts,
            resolvedFileName: 'filename.ts'
        };
        const { resolveStub, moduleResolver } = setup(resolvedModule);
        // first call
        moduleResolver.resolveModuleNames(
            ['./normal.ts'],
            'C:/somerepo/somefile.svelte',
            undefined,
            undefined,
            undefined as any
        );
        // second call, which should be from cache
        const result = moduleResolver.resolveModuleNames(
            ['./normal.ts'],
            'C:/somerepo/somefile.svelte',
            undefined,
            undefined,
            undefined as any
        );

        assert.deepStrictEqual(result, [resolvedModule]);
        assert.deepStrictEqual(resolveStub.callCount, 1);
    });
});
