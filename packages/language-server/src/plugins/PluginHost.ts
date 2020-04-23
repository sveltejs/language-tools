import { flatten } from 'lodash';
import {
    CodeAction,
    CodeActionContext,
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    Hover,
    Position,
    Range,
    SymbolInformation,
    TextDocumentIdentifier,
    TextEdit,
    FileChangeType,
} from 'vscode-languageserver';
import { LSConfig, LSConfigManager } from '../ls-config';
import { DocumentManager } from '../lib/documents';
import { LSProvider, Plugin, OnWatchFileChanges } from './interfaces';

enum ExecuteMode {
    None,
    FirstNonNull,
    Collect,
}

export class PluginHost implements LSProvider, OnWatchFileChanges {
    private plugins: Plugin[] = [];

    constructor(private documentsManager: DocumentManager, private config: LSConfigManager) {}

    register(plugin: Plugin) {
        this.plugins.push(plugin);
        plugin.onRegister(this.documentsManager, this.config);
    }

    updateConfig(config: LSConfig) {
        this.config.update(config);
    }

    async getDiagnostics(textDocument: TextDocumentIdentifier): Promise<Diagnostic[]> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<Diagnostic[]>('getDiagnostics', [document], ExecuteMode.Collect),
        );
    }

    async doHover(textDocument: TextDocumentIdentifier, position: Position): Promise<Hover | null> {
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        const completions = (
            await this.execute<CompletionList>(
                'getCompletions',
                [document, position, triggerCharacter],
                ExecuteMode.Collect,
            )
        ).filter(completion => completion != null);

        const flattenedCompletions = flatten(completions.map(completion => completion.items));
        return CompletionList.create(
            flattenedCompletions,
            completions.reduce(
                (incomplete, completion) => incomplete || completion.isIncomplete,
                false as boolean,
            ),
        );
    }

    async formatDocument(textDocument: TextDocumentIdentifier): Promise<TextEdit[]> {
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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
        const document = this.getDocument(textDocument.uri);
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

    onWatchFileChanges(fileName: string, changeType: FileChangeType): void {
        for (const support of this.plugins) {
            support.onWatchFileChanges?.(fileName, changeType);
        }
    }

    private getDocument(uri: string) {
        return this.documentsManager.documents.get(uri);
    }

    private execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode.FirstNonNull,
    ): Promise<T | null>;
    private execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode.Collect,
    ): Promise<T[]>;
    private execute<T>(name: keyof LSProvider, args: any[], mode: ExecuteMode.None): Promise<void>;
    private async execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode,
    ): Promise<(T | null) | T[] | void> {
        const plugins = this.plugins.filter(plugin => typeof plugin[name] === 'function');

        switch (mode) {
            case ExecuteMode.FirstNonNull:
                for (const plugin of plugins) {
                    const res = await this.tryExecutePlugin(plugin, name, args, null);
                    if (res != null) {
                        return res;
                    }
                }
                return null;
            case ExecuteMode.Collect:
                return Promise.all(
                    plugins.map(plugin => this.tryExecutePlugin(plugin, name, args, [])),
                );
            case ExecuteMode.None:
                await Promise.all(
                    plugins.map(plugin => this.tryExecutePlugin(plugin, name, args, null)),
                );
                return;
        }
    }

    private async tryExecutePlugin(plugin: any, fnName: string, args: any[], failValue: any) {
        try {
            return await plugin[fnName](...args);
        } catch (e) {
            return failValue;
        }
    }
}
