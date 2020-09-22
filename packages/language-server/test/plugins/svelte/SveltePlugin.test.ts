import * as assert from 'assert';
import { SveltePlugin } from '../../../src/plugins';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { Diagnostic, Range, DiagnosticSeverity } from 'vscode-languageserver';
import { LSConfigManager } from '../../../src/ls-config';
import * as importPackage from '../../../src/importPackage';
import sinon from 'sinon';

describe('Svelte Plugin', () => {
    function setup(content: string, prettierConfig?: any) {
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new SveltePlugin(pluginManager, prettierConfig);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostic warnings', async () => {
        const { plugin, document } = setup('<h1>Hello, world!</h1>\n<img src="hello.png">');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(1, 0, 1, 21),
            'A11y: <img> element should have an alt attribute',
            DiagnosticSeverity.Warning,
            'a11y-missing-attribute',
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    it('provides diagnostic errors', async () => {
        const { plugin, document } = setup('<div bind:whatever></div>');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(0, 10, 0, 18),
            'whatever is not declared',
            DiagnosticSeverity.Error,
            'binding-undeclared',
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    describe('#formatDocument', () => {
        function stubPrettier(configExists: boolean) {
            const formatStub = sinon.stub().returns('formatted');

            sinon.stub(importPackage, 'importPrettier').returns(<any>{
                resolveConfig: () => Promise.resolve(configExists && { fromConfig: true }),
                getFileInfo: () => ({ ignored: false }),
                format: formatStub,
                getSupportInfo: () => ({ languages: [{ name: 'svelte' }] }),
            });

            return formatStub;
        }

        async function testFormat(configExists: boolean, fallbackPrettierConfigExists: boolean) {
            const { plugin, document } = setup(
                'unformatted',
                fallbackPrettierConfigExists ? { fallbackConfig: true } : undefined,
            );
            const formatStub = stubPrettier(configExists);

            const formatted = await plugin.formatDocument(document, {
                insertSpaces: true,
                tabSize: 4,
            });
            assert.deepStrictEqual(formatted, [
                {
                    newText: 'formatted',
                    range: {
                        end: {
                            character: 11,
                            line: 0,
                        },
                        start: {
                            character: 0,
                            line: 0,
                        },
                    },
                },
            ]);

            return formatStub;
        }

        afterEach(() => {
            sinon.restore();
        });

        it('should use config for formatting', async () => {
            const formatStub = await testFormat(true, true);
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                fromConfig: true,
                plugins: [],
                parser: 'svelte',
            });
        });

        it('should use prettier fallback config for formatting', async () => {
            const formatStub = await testFormat(false, true);
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                fallbackConfig: true,
                plugins: [],
                parser: 'svelte',
            });
        });

        it('should use FormattingOptions for formatting', async () => {
            const formatStub = await testFormat(false, false);
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                tabWidth: 4,
                useTabs: false,
                plugins: [],
                parser: 'svelte',
            });
        });
    });
});
