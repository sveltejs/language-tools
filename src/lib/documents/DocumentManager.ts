import {
    TextDocumentItem,
    VersionedTextDocumentIdentifier,
    TextDocumentContentChangeEvent,
    TextDocumentIdentifier,
    CompletionItem,
    TextEdit,
} from 'vscode-languageserver-types';
import { PluginHost, ExecuteMode } from '../PluginHost';
import { flatten } from '../../utils';
import { Document, Diagnostic, Hover, Position, ColorInformation } from '../../api';

export interface DocumentManager {
    on(evt: 'documentChange', listener: (document: Document) => void): this;
}

export class DocumentManager extends PluginHost {
    public documents: Map<string, Document> = new Map();
    public locked = new Set<string>();

    constructor(private createDocument: (textDocument: TextDocumentItem) => Document) {
        super();
    }

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
            if (!change.range) {
                end = document.getTextLength();
            } else {
                start = document.offsetAt(change.range.start);
                end = document.offsetAt(change.range.end);
            }

            document.update(change.text, start, end);
        }

        this.notify('documentChange', document);
    }

    async getDiagnostics(textDocument: TextDocumentIdentifier): Promise<Diagnostic[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<Diagnostic[]>('getDiagnostics', [document], ExecuteMode.Collect),
        );
    }

    async doHover(textDocument: TextDocumentIdentifier, position: Position): Promise<Hover | null> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return this.execute<Hover>('doHover', [document, position], ExecuteMode.FirstNonNull);
    }

    async getCompletions(
        textDocument: TextDocumentIdentifier,
        position: Position,
    ): Promise<CompletionItem[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<CompletionItem[]>(
                'getCompletions',
                [document, position],
                ExecuteMode.Collect,
            ),
        );
    }

    async formatDocument(textDocument: TextDocumentIdentifier): Promise<TextEdit[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<TextEdit[]>('formatDocument', [document], ExecuteMode.Collect),
        );
    }

    async doTagComplete(
        textDocument: TextDocumentIdentifier,
        position: Position,
    ): Promise<string | null> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return this.execute<string | null>(
            'doTagComplete',
            [document, position],
            ExecuteMode.FirstNonNull,
        );
    }

    async getDocumentColors(textDocument: TextDocumentIdentifier): Promise<ColorInformation[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<ColorInformation[]>(
                'getDocumentColors',
                [document],
                ExecuteMode.Collect,
            ),
        );
    }
}
