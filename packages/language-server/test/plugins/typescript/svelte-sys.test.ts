import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import { DocumentSnapshot } from '../../../src/plugins/typescript/DocumentSnapshot';
import { createSvelteSys } from '../../../src/plugins/typescript/svelte-sys';

describe('Svelte Sys', () => {
    afterEach(() => {
        sinon.restore();
    });

    function setupLoader() {
        const tsFile = 'const a = "ts file";';
        const svelteFile = 'const a = "svelte file";';
        const snapshot: DocumentSnapshot = {
            getText: (_, __) => svelteFile,
            getLength: () => svelteFile.length,
            getChangeRange: () => undefined,
            scriptKind: ts.ScriptKind.TS,
            version: 0,
        };
        const fileExistsStub = sinon.stub().returns(true);
        const readFileStub = sinon.stub().returns(tsFile);
        const getSvelteSnapshotStub = sinon.stub().returns(snapshot);

        sinon.replace(ts.sys, 'fileExists', fileExistsStub);
        sinon.replace(ts.sys, 'readFile', readFileStub);
        const loader = createSvelteSys(getSvelteSnapshotStub);

        return {
            tsFile,
            svelteFile,
            snapshot,
            fileExistsStub,
            readFileStub,
            getSvelteSnapshotStub,
            loader,
        };
    }

    describe('#fileExists', () => {
        it('should leave files with no .svelte.ts-ending as is', async () => {
            const { loader, fileExistsStub } = setupLoader();
            loader.fileExists('../file.ts');

            assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.ts');
        });

        it('should convert .svelte.ts-endings', async () => {
            const { loader, fileExistsStub } = setupLoader();
            loader.fileExists('../file.svelte.ts');

            assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.svelte');
        });
    });

    describe('#readFile', () => {
        it('should delegate read to ts.sys for files with no .svelte.ts-ending as is', async () => {
            const { loader, readFileStub, getSvelteSnapshotStub, tsFile } = setupLoader();
            const code = loader.readFile('../file.ts')!;

            assert.strictEqual(readFileStub.getCall(0).args[0], '../file.ts');
            assert.strictEqual(getSvelteSnapshotStub.called, false);
            assert.strictEqual(code, tsFile);
        });

        it('should convert .svelte.ts-endings and invoke getSvelteSnapshot', async () => {
            const { loader, readFileStub, getSvelteSnapshotStub, svelteFile } = setupLoader();
            const code = loader.readFile('../file.svelte.ts')!;

            assert.strictEqual(readFileStub.getCall(0).args[0], '../file.svelte');
            assert.strictEqual(getSvelteSnapshotStub.called, true);
            assert.strictEqual(code, svelteFile);
        });
    });
});
