import { EventEmitter } from 'events';
import {
    Document,
    TextDocumentContentChangeEvent,
    TextDocumentIdentifier,
    TextDocumentItem,
    VersionedTextDocumentIdentifier,
} from '../../api';

export type DocumentEvent = 'documentOpen' | 'documentChange' | 'documentClose';

export class DocumentManager {
    private emitter = new EventEmitter();
    public documents: Map<string, Document> = new Map();
    public locked = new Set<string>();

    constructor(private createDocument: (textDocument: TextDocumentItem) => Document) {}

    openDocument(textDocument: TextDocumentItem): Document {
        let document: Document;
        if (this.documents.has(textDocument.uri)) {
            document = this.documents.get(textDocument.uri)!;
            document.setText(textDocument.text);
        } else {
            document = this.createDocument(textDocument);
            this.documents.set(textDocument.uri, document);
            this.notify('documentOpen', document);
        }

        this.notify('documentChange', document);

        return document;
    }

    lockDocument(uri: string): void {
        this.locked.add(uri);
    }

    closeDocument(textDocument: TextDocumentIdentifier) {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        this.notify('documentClose', document);

        // Some plugin may prevent a document from actually being closed.
        if (!this.locked.has(textDocument.uri)) {
            this.documents.delete(textDocument.uri);
        }
    }

    updateDocument(
        textDocument: VersionedTextDocumentIdentifier,
        changes: TextDocumentContentChangeEvent[],
    ) {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        for (const change of changes) {
            let start = 0;
            let end = 0;
            if ('range' in change) {
                start = document.offsetAt(change.range.start);
                end = document.offsetAt(change.range.end);
            } else {
                end = document.getTextLength();
            }

            document.update(change.text, start, end);
        }

        this.notify('documentChange', document);
    }

    on(name: DocumentEvent, listener: (document: Document) => void) {
        this.emitter.on(name, listener);
    }

    private notify(name: DocumentEvent, document: Document) {
        this.emitter.emit(name, document);
    }
}
