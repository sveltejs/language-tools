import { EventEmitter } from 'events';
import {
    TextDocumentContentChangeEvent,
    TextDocumentItem,
    VersionedTextDocumentIdentifier
} from 'vscode-languageserver';
import { Document } from './Document';
import { normalizeUri } from '../../utils';
import ts from 'typescript';
import { FileMap, FileSet } from './fileCollection';

export type DocumentEvent = 'documentOpen' | 'documentChange' | 'documentClose';

/**
 * Manages svelte documents
 */
export class DocumentManager {
    private emitter = new EventEmitter();
    private documents: FileMap<Document>;
    private locked: FileSet;
    private deleteCandidates: FileSet;

    constructor(
        private createDocument: (textDocument: Pick<TextDocumentItem, 'text' | 'uri'>) => Document,
        options: { useCaseSensitiveFileNames: boolean } = {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames
        }
    ) {
        this.documents = new FileMap(options.useCaseSensitiveFileNames);
        this.locked = new FileSet(options.useCaseSensitiveFileNames);
        this.deleteCandidates = new FileSet(options.useCaseSensitiveFileNames);
    }

    openClientDocument(textDocument: Pick<TextDocumentItem, 'text' | 'uri'>): Document {
        return this.openDocument(textDocument, /**openedByClient */ true);
    }

    openDocument(
        textDocument: Pick<TextDocumentItem, 'text' | 'uri'>,
        openedByClient: boolean
    ): Document {
        textDocument = {
            ...textDocument,
            uri: normalizeUri(textDocument.uri)
        };

        let document: Document;
        if (this.documents.has(textDocument.uri)) {
            document = this.documents.get(textDocument.uri)!;
            // open state should only be updated when the document is closed
            document.openedByClient ||= openedByClient;
            document.setText(textDocument.text);
        } else {
            document = this.createDocument(textDocument);
            document.openedByClient = openedByClient;
            this.documents.set(textDocument.uri, document);
            this.notify('documentOpen', document);
        }

        this.notify('documentChange', document);

        return document;
    }

    lockDocument(uri: string): void {
        this.locked.add(normalizeUri(uri));
    }

    markAsOpenedInClient(uri: string): void {
        const document = this.documents.get(normalizeUri(uri));
        if (document) {
            document.openedByClient = true;
        }
    }

    getAllOpenedByClient() {
        return Array.from(this.documents.entries()).filter((doc) => doc[1].openedByClient);
    }

    isOpenedInClient(uri: string) {
        const document = this.documents.get(normalizeUri(uri));
        return !!document?.openedByClient;
    }

    releaseDocument(uri: string): void {
        uri = normalizeUri(uri);

        this.locked.delete(uri);
        const document = this.documents.get(uri);
        if (document) {
            document.openedByClient = false;
        }
        if (this.deleteCandidates.has(uri)) {
            this.deleteCandidates.delete(uri);
            this.closeDocument(uri);
        }
    }

    closeDocument(uri: string) {
        uri = normalizeUri(uri);

        const document = this.documents.get(uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        this.notify('documentClose', document);

        // Some plugin may prevent a document from actually being closed.
        if (!this.locked.has(uri)) {
            this.documents.delete(uri);
        } else {
            this.deleteCandidates.add(uri);
        }

        document.openedByClient = false;
    }

    updateDocument(
        textDocument: VersionedTextDocumentIdentifier,
        changes: TextDocumentContentChangeEvent[]
    ) {
        const document = this.documents.get(normalizeUri(textDocument.uri));
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

    get(uri: string) {
        return this.documents.get(normalizeUri(uri));
    }

    private notify(name: DocumentEvent, document: Document) {
        this.emitter.emit(name, document);
    }
}
