import sinon from 'sinon';
import * as assert from 'assert';
import { TextDocumentItem, Range } from 'vscode-languageserver-types';
import { DocumentManager, Document } from '../../../src/lib/documents';

describe('Document Manager', () => {
    const textDocument: TextDocumentItem = {
        uri: 'file:///hello.svelte',
        version: 0,
        languageId: 'svelte',
        text: 'Hello, world!'
    };

    const createTextDocument = (textDocument: Pick<TextDocumentItem, 'uri' | 'text'>) =>
        new Document(textDocument.uri, textDocument.text);

    it('opens documents', () => {
        const createDocument = sinon.spy((_) => new Document('', ''));
        const manager = new DocumentManager(createDocument);

        manager.openClientDocument(textDocument);

        sinon.assert.calledOnce(createDocument);
        sinon.assert.calledWith(createDocument.firstCall, textDocument);
    });

    it('updates the whole document', () => {
        const document = createTextDocument(textDocument);
        const update = sinon.spy(document, 'update');
        const createDocument = sinon.stub().returns(document);
        const manager = new DocumentManager(createDocument);

        manager.openClientDocument(textDocument);
        manager.updateDocument(textDocument, [{ text: 'New content' }]);

        sinon.assert.calledOnce(update);
        sinon.assert.calledWith(update.firstCall, 'New content', 0, textDocument.text.length);
    });

    it('updates the parts of the document', () => {
        const document = createTextDocument(textDocument);
        const update = sinon.spy(document, 'update');
        const createDocument = sinon.stub().returns(document);
        const manager = new DocumentManager(createDocument);

        manager.openClientDocument(textDocument);
        manager.updateDocument(textDocument, [
            {
                text: 'svelte',
                range: Range.create(0, 7, 0, 12),
                rangeLength: 5
            },
            {
                text: 'Greetings',
                range: Range.create(0, 0, 0, 5),
                rangeLength: 5
            }
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

        manager.openClientDocument(textDocument);
        sinon.assert.calledOnce(cb);

        manager.updateDocument(textDocument, []);
        sinon.assert.calledTwice(cb);
    });

    it('update document in case-insensitive fs with different casing', () => {
        const textDocument: TextDocumentItem = {
            uri: 'file:///hello2.svelte',
            version: 0,
            languageId: 'svelte',
            text: 'Hello, world!'
        };
        const manager = new DocumentManager(createTextDocument, {
            useCaseSensitiveFileNames: false
        });

        manager.openClientDocument(textDocument);
        const firstVersion = manager.get(textDocument.uri)!.version;

        const position = { line: 0, character: textDocument.text.length };
        manager.updateDocument(
            {
                ...textDocument,
                uri: 'file:///Hello2.svelte'
            },
            [
                {
                    range: { start: position, end: position },
                    text: ' '
                }
            ]
        );

        assert.ok(manager.get(textDocument.uri)!.version > firstVersion);
    });
});
