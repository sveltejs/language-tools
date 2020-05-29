import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { TypeScriptPlugin } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';

describe('TypescriptPlugin', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, '..');
        const filePath = path.join(testDir, 'testfiles', filename);
        const document = new Document(pathToUrl(filePath), ts.sys.readFile(filePath)!);
        const pluginManager = new LSConfigManager();
        const plugin = new TypeScriptPlugin(docManager, pluginManager, testDir);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostics', async () => {
        const { plugin, document } = setup('diagnostics.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'true' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 32,
                        line: 0,
                    },
                    end: {
                        character: 35,
                        line: 0,
                    },
                },
                severity: 1,
                source: 'ts',
            },
        ]);
    });

    it('provides typecheck diagnostics for js file when //@ts-check at top of script', async () => {
        const { plugin, document } = setup('diagnostics-js-typecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2339,
                message: "Property 'bla' does not exist on type '1'.",
                range: {
                    start: {
                        character: 4,
                        line: 3,
                    },
                    end: {
                        character: 7,
                        line: 3,
                    },
                },
                severity: 1,
                source: 'js',
            },
        ]);
    });

    it('provides no typecheck diagnostics for js file', async () => {
        const { plugin, document } = setup('diagnostics-js-notypecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });

    it('provides diagnostics when there is a parser error', async () => {
        const { plugin, document } = setup('diagnostics-parsererror.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: -1,
                message: 'You can only have one top-level <style> tag per component',
                range: {
                    start: {
                        character: 0,
                        line: 1,
                    },
                    end: {
                        character: 0,
                        line: 1,
                    },
                },
                severity: 1,
                source: 'js',
            },
        ]);
    });

    it('ignore false positives', async () => {
        const { plugin, document } = setup('diagnostics-falsepositives.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });
});
