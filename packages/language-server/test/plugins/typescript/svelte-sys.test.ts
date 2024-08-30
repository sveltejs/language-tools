import * as assert from 'assert';
import sinon from 'sinon';
import ts from 'typescript';
import { createSvelteSys } from '../../../src/plugins/typescript/svelte-sys';

describe('Svelte Sys', () => {
    afterEach(() => {
        sinon.restore();
    });

    function setupLoader() {
        const tsFile = 'const a = "ts file";';
        const svelteFile = 'const a = "svelte file";';

        const fileExistsStub = sinon.stub().returns(true);

        // sinon.replace(ts.sys, 'fileExists', fileExistsStub);
        const loader = createSvelteSys({
            ...ts.sys,
            fileExists: fileExistsStub
        });

        return {
            tsFile,
            svelteFile,
            fileExistsStub,
            loader
        };
    }

    describe('#fileExists', () => {
        it('should leave files with no .d.svelte.ts-ending as is', async () => {
            const { loader, fileExistsStub } = setupLoader();
            loader.fileExists('../file.ts');

            assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.ts');
        });

        it('should convert .d.svelte.ts-endings', async () => {
            const { loader, fileExistsStub } = setupLoader();
            fileExistsStub.onCall(0).returns(false);
            fileExistsStub.onCall(1).returns(false);
            fileExistsStub.onCall(2).returns(true);

            loader.fileExists('../file.d.svelte.ts');

            assert.strictEqual(fileExistsStub.getCall(0).args[0], '../file.svelte.d.ts');
            assert.strictEqual(fileExistsStub.getCall(1).args[0], '../file.d.svelte.ts');
            assert.strictEqual(fileExistsStub.getCall(2).args[0], '../file.svelte');
        });
    });
});
