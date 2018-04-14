import {
    TextDocumentItem,
    VersionedTextDocumentIdentifier,
    TextDocumentContentChangeEvent,
} from 'vscode-languageserver-types';
import { Document } from './Document';

export class DocumentManager {
    public documents: Map<string, Document> = new Map();

    constructor(private createDocument: (textDocument: TextDocumentItem) => Document) {}

    openDocument(textDocument: TextDocumentItem) {
        const document = this.createDocument(textDocument);
        this.documents.set(textDocument.uri, document);
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
            if (!change.range) {
                end = document.getTextLength();
            } else {
                start = document.offsetAt(change.range.start);
                end = document.offsetAt(change.range.end);
            }

            document.update(change.text, start, end);
        }
    }
}
