import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import * as svS from '../../../src/plugins/typescript/svelte-sys';
import { DocumentSnapshot } from '../../../src/plugins/typescript/DocumentSnapshot';
import { createSvelteModuleLoader } from '../../../src/plugins/typescript/module-loader';
import { TextDocument } from '../../../src/lib/documents';

describe('createSvelteModuleLoader', () => {
    afterEach(() => {
        sinon.restore();
    });

    function setup(resolvedModule: ts.ResolvedModuleFull) {
        const svelteFile = 'const a = "svelte file";';
        const snapshot: DocumentSnapshot = DocumentSnapshot.fromDocument(
            new TextDocument('', svelteFile),
        );
        const getSvelteSnapshotStub = sinon.stub().returns(snapshot);

        const resolveStub = sinon.stub().returns(<ts.ResolvedModuleWithFailedLookupLocations>{
            resolvedModule,
        });
        sinon.replace(ts, 'resolveModuleName', resolveStub);

        const svelteSys = <any>'svelteSys';
        sinon.stub(svS, 'createSvelteSys').returns(svelteSys);

        const compilerOptions: ts.CompilerOptions = { strict: true };
        const moduleResolver = createSvelteModuleLoader(getSvelteSnapshotStub, compilerOptions);

        return {
            getSvelteSnapshotStub,
            resolveStub,
            compilerOptions,
            moduleResolver,
            svelteSys,
        };
    }

    it('uses tsSys for normal files', async () => {
        const resolvedModule: ts.ResolvedModuleFull = {
            extension: ts.Extension.Ts,
            resolvedFileName: 'filename.ts',
        };
        const { resolveStub, moduleResolver, compilerOptions } = setup(resolvedModule);
        const result = moduleResolver.resolveModuleNames(
            ['./normal.ts'],
            'C:/somerepo/somefile.svelte',
        );

        assert.deepStrictEqual(result, [resolvedModule]);
        assert.deepStrictEqual(resolveStub.getCall(0).args, [
            './normal.ts',
            'C:/somerepo/somefile.svelte',
            compilerOptions,
            ts.sys,
        ]);
    });

    it('uses svelte module loader for virtual svelte files', async () => {
        const resolvedModule: ts.ResolvedModuleFull = {
            extension: ts.Extension.Ts,
            resolvedFileName: 'filename.svelte.ts',
        };
        const {
            resolveStub,
            svelteSys,
            moduleResolver,
            compilerOptions,
            getSvelteSnapshotStub,
        } = setup(resolvedModule);
        const result = moduleResolver.resolveModuleNames(
            ['./svelte.svelte'],
            'C:/somerepo/somefile.svelte',
        );

        assert.deepStrictEqual(result, [
            <ts.ResolvedModuleFull>{
                extension: ts.Extension.Jsx,
                resolvedFileName: 'filename.svelte',
            },
        ]);
        assert.deepStrictEqual(resolveStub.getCall(0).args, [
            './svelte.svelte',
            'C:/somerepo/somefile.svelte',
            compilerOptions,
            svelteSys,
        ]);
        assert.deepStrictEqual(getSvelteSnapshotStub.getCall(0).args, ['filename.svelte']);
    });

    it('uses cache if module was already resolved before', async () => {
        const resolvedModule: ts.ResolvedModuleFull = {
            extension: ts.Extension.Ts,
            resolvedFileName: 'filename.ts',
        };
        const { resolveStub, moduleResolver } = setup(resolvedModule);
        // first call
        moduleResolver.resolveModuleNames(['./normal.ts'], 'C:/somerepo/somefile.svelte');
        // second call, which should be from cache
        const result = moduleResolver.resolveModuleNames(
            ['./normal.ts'],
            'C:/somerepo/somefile.svelte',
        );

        assert.deepStrictEqual(result, [resolvedModule]);
        assert.deepStrictEqual(resolveStub.callCount, 1);
    });
});
