import * as assert from 'assert';
import { SveltePlugin } from '../../../src/plugins';
import { DocumentManager, Document } from '../../../src/lib/documents';
import {
    Diagnostic,
    Range,
    DiagnosticSeverity,
    CancellationTokenSource
} from 'vscode-languageserver';
import { LSConfigManager } from '../../../src/ls-config';
import * as importPackage from '../../../src/importPackage';
import sinon from 'sinon';
import { join } from 'path';
import { pathToUrl, urlToPath } from '../../../src/utils';
import { VERSION } from 'svelte/compiler';

const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

describe('Svelte Plugin', () => {
    function setup(
        content: string,
        prettierConfig?: any,
        { trusted = true, documentUri = 'file:///hello.svelte' } = {}
    ) {
        const document = new Document(documentUri, content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        pluginManager.updateIsTrusted(trusted);
        pluginManager.updatePrettierConfig(prettierConfig);
        const plugin = new SveltePlugin(pluginManager);
        docManager.openClientDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostic warnings', async () => {
        const { plugin, document } = setup('<h1>Hello, world!</h1>\n<img src="hello.png">');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(1, 0, 1, 21),
            isSvelte5Plus
                ? '`<img>` element should have an alt attribute'
                : 'A11y: <img> element should have an alt attribute',
            DiagnosticSeverity.Warning,
            isSvelte5Plus ? 'a11y_missing_attribute' : 'a11y-missing-attribute',
            'svelte'
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    it('provides diagnostic errors', async () => {
        const { plugin, document } = setup('<div bind:whatever></div>');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(0, 10, 0, 18),
            isSvelte5Plus ? 'Can only bind to state or props' : 'whatever is not declared',
            DiagnosticSeverity.Error,
            isSvelte5Plus ? 'bind_invalid_value' : 'binding-undeclared',
            'svelte'
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    it('provides no diagnostic errors when untrusted', async () => {
        const { plugin, document } = setup('<div bind:whatever></div>', {}, { trusted: false });

        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });

    describe('#formatDocument', () => {
        function stubPrettierV2(config: any) {
            const formatStub = sinon.stub().returns('formatted');

            sinon.stub(importPackage, 'importPrettier').returns(<any>{
                version: '2.8.0',
                resolveConfig: () => Promise.resolve(config),
                getFileInfo: () => ({ ignored: false }),
                format: formatStub,
                getSupportInfo: () => ({ languages: [{ name: 'svelte' }] })
            });

            return formatStub;
        }

        async function testFormat(
            config: any,
            fallbackPrettierConfig: any,
            options?: Parameters<typeof setup>[2],
            stubPrettier = stubPrettierV2
        ) {
            const { plugin, document } = setup('unformatted', fallbackPrettierConfig, options);
            const formatStub = stubPrettier(config);

            const formatted = await plugin.formatDocument(document, {
                insertSpaces: true,
                tabSize: 4
            });
            assert.deepStrictEqual(formatted, [
                {
                    newText: 'formatted',
                    range: {
                        end: {
                            character: 11,
                            line: 0
                        },
                        start: {
                            character: 0,
                            line: 0
                        }
                    }
                }
            ]);

            return formatStub;
        }

        afterEach(() => {
            sinon.restore();
        });

        it('should use config for formatting', async () => {
            const formatStub = await testFormat({ fromConfig: true }, { fallbackConfig: true });
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                fromConfig: true,
                plugins: [],
                parser: 'svelte'
            });
        });

        it('can resolve plugin for formatting', async () => {
            const documentUri = pathToUrl(join(__dirname, 'testFiles', 'do-not-exist.svelte'));
            const formatStub = await testFormat(
                { fromConfig: true, plugins: ['prettier-plugin-svelte'] },
                { fallbackConfig: true },
                { documentUri }
            );
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                fromConfig: true,
                plugins: [
                    require.resolve('prettier-plugin-svelte', { paths: [urlToPath(documentUri)!] })
                ],
                parser: 'svelte'
            });
        });

        const defaultSettings = {
            svelteSortOrder: 'options-scripts-markup-styles',
            svelteStrictMode: false,
            svelteAllowShorthand: true,
            svelteBracketNewLine: true,
            svelteIndentScriptAndStyle: true,
            printWidth: 80,
            singleQuote: false
        };

        it('should use prettier fallback config for formatting', async () => {
            const formatStub = await testFormat(undefined, { fallbackConfig: true });
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                fallbackConfig: true,
                plugins: [],
                parser: 'svelte',
                ...defaultSettings
            });
        });

        it('should use FormattingOptions for formatting', async () => {
            const formatStub = await testFormat(undefined, undefined);
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                tabWidth: 4,
                useTabs: false,
                plugins: [],
                parser: 'svelte',
                ...defaultSettings
            });
        });

        it('should use FormattingOptions for formatting when configs are empty objects', async () => {
            const formatStub = await testFormat({}, {});
            sinon.assert.calledOnceWithExactly(formatStub, 'unformatted', {
                tabWidth: 4,
                useTabs: false,
                plugins: [],
                parser: 'svelte',
                ...defaultSettings
            });
        });

        it('should load the user prettier version (version 2)', async () => {
            function stubPrettier(config: any) {
                const formatStub = sinon.stub().returns('formatted');

                sinon
                    .stub(importPackage, 'importPrettier')
                    .onFirstCall()
                    .returns(<any>{
                        version: '2.8.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: formatStub,
                        getSupportInfo: () => ({ languages: [{ name: 'svelte' }] })
                    })
                    .onSecondCall()
                    .throws(new Error('should not be called'));

                return formatStub;
            }

            await testFormat({}, {}, undefined, stubPrettier);
        });

        it("should load user plugin if it's module", async () => {
            function stubPrettier(config: any) {
                const formatStub = sinon.stub().returns('formatted');

                sinon
                    .stub(importPackage, 'importPrettier')
                    .onFirstCall()
                    .returns(<any>{
                        version: '2.8.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: formatStub,
                        getSupportInfo: () => ({ languages: [{ name: 'svelte' }] })
                    })
                    .onSecondCall()
                    .throws(new Error('should not be called'));

                return formatStub;
            }

            await testFormat(
                {},
                {
                    plugins: [require('prettier-plugin-svelte')]
                },
                undefined,
                stubPrettier
            );
        });

        it('should load the user prettier version (version 2)', async () => {
            function stubPrettier(config: any) {
                const formatStub = sinon.stub().returns(Promise.resolve('formatted'));

                sinon
                    .stub(importPackage, 'importPrettier')
                    .onFirstCall()
                    .returns(<any>{
                        version: '2.0.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: formatStub,
                        getSupportInfo: () => Promise.resolve({ languages: [] })
                    })
                    .onSecondCall()
                    .throws(new Error('should not be called'));

                return formatStub;
            }

            await testFormat(
                // written like this to not trigger require.resolve which fails here
                { plugins: ['./node_modules/prettier-plugin-svelte'] },
                {},
                undefined,
                stubPrettier
            );
        });

        it('should fall back to built-in prettier version', async () => {
            function stubPrettier(config: any) {
                const formatStub = sinon.stub().returns('formatted');

                sinon
                    .stub(importPackage, 'importPrettier')
                    .onFirstCall()
                    .returns(<any>{
                        version: '2.8.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: () => {
                            throw new Error('should not be called');
                        },
                        getSupportInfo: () => Promise.resolve({ languages: [] })
                    })
                    .onSecondCall()
                    .returns(<any>{
                        version: '3.1.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: formatStub,
                        getSupportInfo: () => ({ languages: [] })
                    })
                    .onThirdCall()
                    .throws(new Error('should not be called'));

                return formatStub;
            }

            await testFormat({}, {}, undefined, stubPrettier);
        });

        it('should fall back to built-in prettier version when failing to resolve plugins config', async () => {
            function stubPrettier(config: any) {
                const formatStub = sinon.stub().returns('formatted');

                sinon
                    .stub(importPackage, 'importPrettier')
                    .onFirstCall()
                    .returns(<any>{
                        version: '2.8.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: () => {
                            throw new Error('should not be called');
                        },
                        getSupportInfo: () => Promise.resolve({ languages: [] })
                    })
                    .onSecondCall()
                    .returns(<any>{
                        version: '3.0.0',
                        resolveConfig: () => Promise.resolve(config),
                        getFileInfo: () => ({ ignored: false }),
                        format: formatStub,
                        getSupportInfo: () => ({ languages: [] })
                    })
                    .onThirdCall()
                    .throws(new Error('should not be called'));

                return formatStub;
            }

            await testFormat(
                {
                    plugins: ['@do-not-exist/prettier-plugin-svelte']
                },
                {},
                undefined,
                stubPrettier
            );
        });
    });

    it('can cancel completion before promise resolved', async () => {
        const { plugin, document } = setup('{#');
        const cancellationTokenSource = new CancellationTokenSource();

        const completionsPromise = plugin.getCompletions(
            document,
            { line: 0, character: 2 },
            undefined,
            cancellationTokenSource.token
        );

        cancellationTokenSource.cancel();

        assert.deepStrictEqual(await completionsPromise, null);
    });

    it('can cancel code action before promise resolved', async () => {
        const { plugin, document } = setup('<a></a>');
        const cancellationTokenSource = new CancellationTokenSource();
        const range = {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 7 }
        };

        const codeActionPromise = plugin.getCodeActions(
            document,
            range,
            {
                diagnostics: [
                    {
                        message: 'A11y: <a> element should have child content',
                        code: 'a11y-missing-content',
                        range,
                        severity: DiagnosticSeverity.Warning,
                        source: 'svelte'
                    }
                ]
            },
            cancellationTokenSource.token
        );

        cancellationTokenSource.cancel();

        assert.deepStrictEqual(await codeActionPromise, []);
    });
});
