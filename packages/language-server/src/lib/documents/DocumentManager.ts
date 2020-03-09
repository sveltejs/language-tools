import { PluginHost, ExecuteMode } from '../PluginHost';
import { flatten } from '../../utils';
import {
    Document,
    Diagnostic,
    Hover,
    Position,
    ColorInformation,
    Range,
    Color,
    ColorPresentation,
    SymbolInformation,
    TextDocumentItem,
    TextDocumentIdentifier,
    VersionedTextDocumentIdentifier,
    TextDocumentContentChangeEvent,
    TextEdit,
    DefinitionLink,
    CodeActionContext,
    CodeAction,
    CompletionList,
} from '../../api';

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
            if ("range" in change) {
                start = document.offsetAt(change.range.start);
                end = document.offsetAt(change.range.end);
            } else {
                end = document.getTextLength();
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
        triggerCharacter?: string,
    ): Promise<CompletionList> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        const completions = (await this.execute<CompletionList>(
            'getCompletions',
            [document, position, triggerCharacter],
            ExecuteMode.Collect,
        )).filter(completion => completion != null);

        return CompletionList.create(
            flatten(completions.map(completion => completion.items)),
            completions.reduce(
                (incomplete, completion) => incomplete || completion.isIncomplete,
                false as boolean,
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

    async getColorPresentations(
        textDocument: TextDocumentIdentifier,
        range: Range,
        color: Color,
    ): Promise<ColorPresentation[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<ColorPresentation[]>(
                'getColorPresentations',
                [document, range, color],
                ExecuteMode.Collect,
            ),
        );
    }

    async getDocumentSymbols(textDocument: TextDocumentIdentifier): Promise<SymbolInformation[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<SymbolInformation[]>(
                'getDocumentSymbols',
                [document],
                ExecuteMode.Collect,
            ),
        );
    }

    async getDefinitions(
        textDocument: TextDocumentIdentifier,
        position: Position,
    ): Promise<DefinitionLink[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<DefinitionLink[]>(
                'getDefinitions',
                [document, position],
                ExecuteMode.Collect,
            ),
        );
    }

    async getCodeActions(
        textDocument: TextDocumentIdentifier,
        range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]> {
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<CodeAction[]>(
                'getCodeActions',
                [document, range, context],
                ExecuteMode.Collect,
            ),
        );
    }
}
