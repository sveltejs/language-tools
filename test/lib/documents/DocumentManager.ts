import * as sinon from 'sinon';
import * as assert from 'assert';
import { TextDocumentItem, Range, Position } from 'vscode-languageserver-types';
import { TextDocument } from '../../../src/lib/documents/TextDocument';
import { DocumentManager } from '../../../src/lib/documents/DocumentManager';

describe('Document Manager', () => {
    const textDocument: TextDocumentItem = {
        uri: 'file:///hello.html',
        version: 0,
        languageId: '',
        text: 'Hello, world!',
    };

    const createTextDocument = (textDocument: TextDocumentItem) =>
        new TextDocument(textDocument.uri, textDocument.text);

    it('opens documents', () => {
        const createDocument = sinon.spy();
        const manager = new DocumentManager(createDocument);

        manager.openDocument(textDocument);

        sinon.assert.calledOnce(createDocument);
        sinon.assert.calledWith(createDocument.firstCall, textDocument);
    });

    it('updates the whole document', () => {
        const document = createTextDocument(textDocument);
        const update = sinon.spy(document, 'update');
        const createDocument = sinon.stub().returns(document);
        const manager = new DocumentManager(createDocument);

        manager.openDocument(textDocument);
        manager.updateDocument(textDocument, [{ text: 'New content' }]);

        sinon.assert.calledOnce(update);
        sinon.assert.calledWith(update.firstCall, 'New content', 0, textDocument.text.length);
    });

    it('updates the parts of the document', () => {
        const document = createTextDocument(textDocument);
        const update = sinon.spy(document, 'update');
        const createDocument = sinon.stub().returns(document);
        const manager = new DocumentManager(createDocument);

        manager.openDocument(textDocument);
        manager.updateDocument(textDocument, [
            {
                text: 'svelte',
                range: Range.create(0, 7, 0, 12),
                rangeLength: 5,
            },
            {
                text: 'Greetings',
                range: Range.create(0, 0, 0, 5),
                rangeLength: 5,
            },
        ]);

        sinon.assert.calledTwice(update);
        sinon.assert.calledWith(update.firstCall, 'svelte', 7, 12);
        sinon.assert.calledWith(update.secondCall, 'Greetings', 0, 5);
    });

    it("fails to update if document isn't open", () => {
        const manager = new DocumentManager(createTextDocument);

        assert.throws(() => manager.updateDocument(textDocument, []));
    });

    it('emits a document change event on open and update', () => {
        const manager = new DocumentManager(createTextDocument);
        const cb = sinon.spy();

        manager.on('documentChange', cb);

        manager.openDocument(textDocument);
        sinon.assert.calledOnce(cb);

        manager.updateDocument(textDocument, []);
        sinon.assert.calledTwice(cb);
    });

    it('executes getDiagnostics on plugins', async () => {
        const manager = new DocumentManager(createTextDocument);
        const plugin = {
            pluginId: 'test',
            defaultConfig: { enable: true },
            getDiagnostics: sinon.stub().returns([]),
        };
        manager.register(plugin);
        const document = manager.openDocument(textDocument);

        await manager.getDiagnostics(textDocument);

        sinon.assert.calledOnce(plugin.getDiagnostics);
        sinon.assert.calledWithExactly(plugin.getDiagnostics, document);
    });

    it('executes doHover on plugins', async () => {
        const manager = new DocumentManager(createTextDocument);
        const plugin = {
            pluginId: 'test',
            defaultConfig: { enable: true },
            doHover: sinon.stub().returns(null),
        };
        manager.register(plugin);
        const document = manager.openDocument(textDocument);

        const pos = Position.create(0, 0);
        await manager.doHover(textDocument, pos);

        sinon.assert.calledOnce(plugin.doHover);
        sinon.assert.calledWithExactly(plugin.doHover, document, pos);
    });

    it('executes getCompletions on plugins', async () => {
        const manager = new DocumentManager(createTextDocument);
        const plugin = {
            pluginId: 'test',
            defaultConfig: { enable: true },
            getCompletions: sinon.stub().returns([]),
        };
        manager.register(plugin);
        const document = manager.openDocument(textDocument);

        const pos = Position.create(0, 0);
        await manager.getCompletions(textDocument, pos, '.');

        sinon.assert.calledOnce(plugin.getCompletions);
        sinon.assert.calledWithExactly(plugin.getCompletions, document, pos, '.');
    });
});
