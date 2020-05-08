import sinon from 'sinon';
import { Position, TextDocumentItem } from 'vscode-languageserver-types';
import { DocumentManager, TextDocument } from '../../src/lib/documents';
import { PluginHost } from '../../src/plugins';

describe('PluginHost', () => {
    const textDocument: TextDocumentItem = {
        uri: 'file:///hello.svelte',
        version: 0,
        languageId: 'svelte',
        text: 'Hello, world!',
    };

    function setup<T>(pluginProviderStubs: T) {
        const createTextDocument = (textDocument: TextDocumentItem) =>
            new TextDocument(textDocument.uri, textDocument.text);

        const docManager = new DocumentManager(createTextDocument);

        const pluginHost = new PluginHost(docManager, <any>{});
        const plugin = {
            onRegister: () => undefined,
            ...pluginProviderStubs,
        };

        pluginHost.register(plugin);

        return { docManager, pluginHost, plugin };
    }

    it('executes getDiagnostics on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            getDiagnostics: sinon.stub().returns([]),
        });
        const document = docManager.openDocument(textDocument);

        await pluginHost.getDiagnostics(textDocument);

        sinon.assert.calledOnce(plugin.getDiagnostics);
        sinon.assert.calledWithExactly(plugin.getDiagnostics, document);
    });

    it('executes doHover on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            doHover: sinon.stub().returns(null),
        });
        const document = docManager.openDocument(textDocument);
        const pos = Position.create(0, 0);

        await pluginHost.doHover(textDocument, pos);

        sinon.assert.calledOnce(plugin.doHover);
        sinon.assert.calledWithExactly(plugin.doHover, document, pos);
    });

    it('executes getCompletions on plugins', async () => {
        const { docManager, pluginHost, plugin } = setup({
            getCompletions: sinon.stub().returns({ items: [] }),
        });
        const document = docManager.openDocument(textDocument);
        const pos = Position.create(0, 0);

        await pluginHost.getCompletions(textDocument, pos, '.');

        sinon.assert.calledOnce(plugin.getCompletions);
        sinon.assert.calledWithExactly(plugin.getCompletions, document, pos, '.');
    });
});
