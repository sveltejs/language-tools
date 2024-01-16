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
});
