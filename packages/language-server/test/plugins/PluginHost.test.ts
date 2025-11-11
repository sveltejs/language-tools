import sinon from 'sinon';
import {
    CompletionItem,
    DocumentSymbol,
    Location,
    LocationLink,
    Position,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocumentItem
} from 'vscode-languageserver-types';
import { DocumentManager, Document } from '../../src/lib/documents';
import { LSPProviderConfig, PluginHost } from '../../src/plugins';
import { CompletionTriggerKind, CancellationToken } from 'vscode-languageserver';
import assert from 'assert';

describe('PluginHost', () => {
    const textDocument: TextDocumentItem = {
        uri: 'file:///hello.svelte',
        version: 0,
        languageId: 'svelte',
        text: 'Hello, world!'
    };

    function setup<T>(
        pluginProviderStubs: T,
        config: LSPProviderConfig = {
            definitionLinkSupport: true,
            filterIncompleteCompletions: false
        }
    ) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );

        const pluginHost = new PluginHost(docManager);
        const plugin = {
            ...pluginProviderStubs,
            __name: 'test'
        };

        pluginHost.initialize(config);
        pluginHost.register(plugin);

        return { docManager, pluginHost, plugin };
    }

    it('executes getDiagnostics on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            getDiagnostics: sinon.stub().returns([])
        });
        const document = docManager.openClientDocument(textDocument);

        await pluginHost.getDiagnostics(textDocument);

        sinon.assert.calledOnce(plugin.getDiagnostics);
        sinon.assert.calledWithExactly(plugin.getDiagnostics, document, undefined);
    });

    it('executes doHover on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            doHover: sinon.stub().returns(null)
        });
        const document = docManager.openClientDocument(textDocument);
        const pos = Position.create(0, 0);

        await pluginHost.doHover(textDocument, pos);

        sinon.assert.calledOnce(plugin.doHover);
        sinon.assert.calledWithExactly(plugin.doHover, document, pos);
    });

    it('executes getCompletions on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            getCompletions: sinon.stub().returns({ items: [] })
        });
        const document = docManager.openClientDocument(textDocument);
        const pos = Position.create(0, 0);

        await pluginHost.getCompletions(textDocument, pos, {
            triggerKind: CompletionTriggerKind.TriggerCharacter,
            triggerCharacter: '.'
        });

        sinon.assert.calledOnce(plugin.getCompletions);
        sinon.assert.calledWithExactly(
            plugin.getCompletions,
            document,
            pos,
            {
                triggerKind: CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: '.'
            },
            undefined
        );
    });

    describe('getCompletions (incomplete)', () => {
        function setupGetIncompleteCompletions(filterServerSide: boolean) {
            const { docManager, pluginHost } = setup(
                {
                    getCompletions: sinon.stub().returns({
                        isIncomplete: true,
                        items: <CompletionItem[]>[{ label: 'Hello' }, { label: 'foo' }]
                    })
                },
                { definitionLinkSupport: true, filterIncompleteCompletions: filterServerSide }
            );
            docManager.openClientDocument(textDocument);
            return pluginHost;
        }

        it('filters client side', async () => {
            const pluginHost = setupGetIncompleteCompletions(false);
            const completions = await pluginHost.getCompletions(
                textDocument,
                Position.create(0, 2)
            );

            assert.deepStrictEqual(completions.items, <CompletionItem[]>[
                { label: 'Hello' },
                { label: 'foo' }
            ]);
        });

        it('filters server side', async () => {
            const pluginHost = setupGetIncompleteCompletions(true);
            const completions = await pluginHost.getCompletions(
                textDocument,
                Position.create(0, 2)
            );

            assert.deepStrictEqual(completions.items, <CompletionItem[]>[{ label: 'Hello' }]);
        });
    });

    describe('getDefinitions', () => {
        function setupGetDefinitions(linkSupport: boolean) {
            const { pluginHost, docManager } = setup(
                {
                    getDefinitions: sinon.stub().returns([
                        <LocationLink>{
                            targetRange: Range.create(Position.create(0, 0), Position.create(0, 2)),
                            targetSelectionRange: Range.create(
                                Position.create(0, 0),
                                Position.create(0, 1)
                            ),
                            targetUri: 'uri'
                        }
                    ])
                },
                { definitionLinkSupport: linkSupport, filterIncompleteCompletions: false }
            );
            docManager.openClientDocument(textDocument);
            return pluginHost;
        }

        it('uses LocationLink', async () => {
            const pluginHost = setupGetDefinitions(true);
            const definitions = await pluginHost.getDefinitions(
                textDocument,
                Position.create(0, 0)
            );

            assert.deepStrictEqual(definitions, [
                <LocationLink>{
                    targetRange: Range.create(Position.create(0, 0), Position.create(0, 2)),
                    targetSelectionRange: Range.create(
                        Position.create(0, 0),
                        Position.create(0, 1)
                    ),
                    targetUri: 'uri'
                }
            ]);
        });

        it('uses Location', async () => {
            const pluginHost = setupGetDefinitions(false);
            const definitions = await pluginHost.getDefinitions(
                textDocument,
                Position.create(0, 0)
            );

            assert.deepStrictEqual(definitions, [
                <Location>{
                    range: Range.create(Position.create(0, 0), Position.create(0, 1)),
                    uri: 'uri'
                }
            ]);
        });
    });

    describe('getHierarchicalDocumentSymbols', () => {
        it('converts flat symbols to hierarchical structure', async () => {
            const cancellation_token: CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            };

            const flat_symbols: SymbolInformation[] = [
                // Root level class (lines 0-10)
                SymbolInformation.create(
                    'MyClass',
                    SymbolKind.Class,
                    Range.create(Position.create(0, 0), Position.create(10, 0)),
                    'file:///hello.svelte'
                ),
                // Method inside class (lines 1-5)
                SymbolInformation.create(
                    'myMethod',
                    SymbolKind.Method,
                    Range.create(Position.create(1, 0), Position.create(5, 0)),
                    'file:///hello.svelte'
                ),
                // Variable inside method (lines 2-3)
                SymbolInformation.create(
                    'localVar',
                    SymbolKind.Variable,
                    Range.create(Position.create(2, 0), Position.create(3, 0)),
                    'file:///hello.svelte'
                ),
                // Another method in class (lines 6-8)
                SymbolInformation.create(
                    'anotherMethod',
                    SymbolKind.Method,
                    Range.create(Position.create(6, 0), Position.create(8, 0)),
                    'file:///hello.svelte'
                ),
                // Root level function (lines 12-15)
                SymbolInformation.create(
                    'topLevelFunction',
                    SymbolKind.Function,
                    Range.create(Position.create(12, 0), Position.create(15, 0)),
                    'file:///hello.svelte'
                )
            ];

            const { docManager, pluginHost } = setup({
                getDocumentSymbols: sinon.stub().returns(flat_symbols)
            });
            docManager.openClientDocument(textDocument);

            const result = await pluginHost.getHierarchicalDocumentSymbols(
                textDocument,
                cancellation_token
            );

            // Should have 2 root symbols: MyClass and topLevelFunction
            assert.strictEqual(result.length, 2);

            // Check first root symbol (MyClass)
            assert.strictEqual(result[0].name, 'MyClass');
            assert.strictEqual(result[0].kind, SymbolKind.Class);
            assert.strictEqual(result[0].children?.length, 2);

            // Check children of MyClass
            assert.strictEqual(result[0].children![0].name, 'myMethod');
            assert.strictEqual(result[0].children![0].kind, SymbolKind.Method);
            assert.strictEqual(result[0].children![0].children?.length, 1);

            // Check nested child (localVar inside myMethod)
            assert.strictEqual(result[0].children![0].children![0].name, 'localVar');
            assert.strictEqual(result[0].children![0].children![0].kind, SymbolKind.Variable);
            assert.strictEqual(result[0].children![0].children![0].children?.length, 0);

            // Check second child of MyClass
            assert.strictEqual(result[0].children![1].name, 'anotherMethod');
            assert.strictEqual(result[0].children![1].kind, SymbolKind.Method);
            assert.strictEqual(result[0].children![1].children?.length, 0);

            // Check second root symbol (topLevelFunction)
            assert.strictEqual(result[1].name, 'topLevelFunction');
            assert.strictEqual(result[1].kind, SymbolKind.Function);
            assert.strictEqual(result[1].children?.length, 0);
        });

        it('handles empty symbol list', async () => {
            const cancellation_token: CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            };

            const { docManager, pluginHost } = setup({
                getDocumentSymbols: sinon.stub().returns([])
            });
            docManager.openClientDocument(textDocument);

            const result = await pluginHost.getHierarchicalDocumentSymbols(
                textDocument,
                cancellation_token
            );

            assert.deepStrictEqual(result, []);
        });

        it('handles symbols with same start position', async () => {
            const cancellation_token: CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            };

            const flat_symbols: SymbolInformation[] = [
                // Two symbols starting at same position, longer one should be parent
                SymbolInformation.create(
                    'outer',
                    SymbolKind.Class,
                    Range.create(Position.create(0, 0), Position.create(10, 0)),
                    'file:///hello.svelte'
                ),
                SymbolInformation.create(
                    'inner',
                    SymbolKind.Method,
                    Range.create(Position.create(0, 0), Position.create(5, 0)),
                    'file:///hello.svelte'
                )
            ];

            const { docManager, pluginHost } = setup({
                getDocumentSymbols: sinon.stub().returns(flat_symbols)
            });
            docManager.openClientDocument(textDocument);

            const result = await pluginHost.getHierarchicalDocumentSymbols(
                textDocument,
                cancellation_token
            );

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'outer');
            assert.strictEqual(result[0].children?.length, 1);
            assert.strictEqual(result[0].children![0].name, 'inner');
        });
    });
});
