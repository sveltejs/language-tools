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
    CompletionItem,
    CompletionContext,
    WorkspaceEdit,
    FormattingOptions,
    ReferenceContext,
    Location,
    SelectionRange
} from 'vscode-languageserver';
import { LSConfig, LSConfigManager } from '../ls-config';
import { DocumentManager } from '../lib/documents';
import {
    LSProvider,
    Plugin,
    OnWatchFileChanges,
    AppCompletionItem,
    FileRename
} from './interfaces';
import { Logger } from '../logger';
import { regexLastIndexOf } from '../utils';

enum ExecuteMode {
    None,
    FirstNonNull,
    Collect,
}

export class PluginHost implements LSProvider, OnWatchFileChanges {
    private filterIncompleteCompletions = false;
    private plugins: Plugin[] = [];

    constructor(private documentsManager: DocumentManager, private config: LSConfigManager) {}

    initialize(dontFilterIncompleteCompletions: boolean) {
        this.filterIncompleteCompletions = !dontFilterIncompleteCompletions;
    }

    register(plugin: Plugin) {
        this.plugins.push(plugin);
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
            await this.execute<Diagnostic[]>('getDiagnostics', [document], ExecuteMode.Collect)
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
        completionContext?: CompletionContext
    ): Promise<CompletionList> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        const completions = (
            await this.execute<CompletionList>(
                'getCompletions',
                [document, position, completionContext],
                ExecuteMode.Collect
            )
        ).filter((completion) => completion != null);

        let flattenedCompletions = flatten(completions.map((completion) => completion.items));
        const isIncomplete = completions.reduce(
            (incomplete, completion) => incomplete || completion.isIncomplete,
            false as boolean
        );

        // If the result is incomplete, we need to filter the results ourselves
        // to throw out non-matching results. VSCode does filter client-side,
        // but other IDEs might not.
        if (isIncomplete && this.filterIncompleteCompletions) {
            const offset = document.offsetAt(position);
            // Assumption for performance reasons:
            // Noone types import names longer than 20 characters and still expects perfect autocompletion.
            const text = document.getText().substring(Math.max(0, offset - 20), offset);
            const start = regexLastIndexOf(text, /[\W\s]/g) + 1;
            const filterValue = text.substring(start).toLowerCase();
            flattenedCompletions = flattenedCompletions.filter((comp) =>
                comp.label.toLowerCase().includes(filterValue)
            );
        }

        return CompletionList.create(flattenedCompletions, isIncomplete);
    }

    async resolveCompletion(
        textDocument: TextDocumentIdentifier,
        completionItem: AppCompletionItem
    ): Promise<CompletionItem> {
        const document = this.getDocument(textDocument.uri);

        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        const result = await this.execute<CompletionItem>(
            'resolveCompletion',
            [document, completionItem],
            ExecuteMode.FirstNonNull
        );

        return result ?? completionItem;
    }

    async formatDocument(
        textDocument: TextDocumentIdentifier,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<TextEdit[]>(
                'formatDocument',
                [document, options],
                ExecuteMode.Collect
            )
        );
    }

    async doTagComplete(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<string | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return this.execute<string | null>(
            'doTagComplete',
            [document, position],
            ExecuteMode.FirstNonNull
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
                ExecuteMode.Collect
            )
        );
    }

    async getColorPresentations(
        textDocument: TextDocumentIdentifier,
        range: Range,
        color: Color
    ): Promise<ColorPresentation[]> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<ColorPresentation[]>(
                'getColorPresentations',
                [document, range, color],
                ExecuteMode.Collect
            )
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
                ExecuteMode.Collect
            )
        );
    }

    async getDefinitions(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<DefinitionLink[]> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<DefinitionLink[]>(
                'getDefinitions',
                [document, position],
                ExecuteMode.Collect
            )
        );
    }

    async getCodeActions(
        textDocument: TextDocumentIdentifier,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return flatten(
            await this.execute<CodeAction[]>(
                'getCodeActions',
                [document, range, context],
                ExecuteMode.Collect
            )
        );
    }

    async executeCommand(
        textDocument: TextDocumentIdentifier,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return await this.execute<WorkspaceEdit>(
            'executeCommand',
            [document, command, args],
            ExecuteMode.FirstNonNull
        );
    }

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        return await this.execute<WorkspaceEdit>(
            'updateImports',
            [fileRename],
            ExecuteMode.FirstNonNull
        );
    }

    async prepareRename(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<Range | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return await this.execute<any>(
            'prepareRename',
            [document, position],
            ExecuteMode.FirstNonNull
        );
    }

    async rename(
        textDocument: TextDocumentIdentifier,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return await this.execute<any>(
            'rename',
            [document, position, newName],
            ExecuteMode.FirstNonNull
        );
    }

    async findReferences(
        textDocument: TextDocumentIdentifier,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return await this.execute<any>(
            'findReferences',
            [document, position, context],
            ExecuteMode.FirstNonNull
        );
    }

    /**
     * The selection range supports multiple cursors,
     * each position should return its own selection range tree like `Array.map`.
     * Quote the LSP spec
     * > A selection range in the return array is for the position in the provided parameters at the same index. Therefore positions[i] must be contained in result[i].range.
     * @see https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_selectionRange
     *
     * Making PluginHost implement the same interface would make it quite hard to get
     * the corresponding selection range of each position from different plugins.
     * Therefore the special treatment here.
     */
    async getSelectionRanges(
        textDocument: TextDocumentIdentifier,
        positions: Position[]
    ): Promise<SelectionRange[] | null> {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        try {
            return Promise.all(positions.map(async (position) => {
                for (const plugin of this.plugins) {
                    const range = await plugin.getSelectionRange?.(document, position);

                    if (range) {
                        return range;
                    }
                }
                return SelectionRange.create(Range.create(position, position));
            }));
        } catch (error) {
            Logger.error(error);
            return null;
        }
    }

    onWatchFileChanges(fileName: string, changeType: FileChangeType): void {
        for (const support of this.plugins) {
            support.onWatchFileChanges?.(fileName, changeType);
        }
    }

    private getDocument(uri: string) {
        return this.documentsManager.get(uri);
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
    private execute(name: keyof LSProvider, args: any[], mode: ExecuteMode.None): Promise<void>;
    private async execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode
    ): Promise<(T | null) | T[] | void> {
        const plugins = this.plugins.filter((plugin) => typeof plugin[name] === 'function');

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
                    plugins.map((plugin) => this.tryExecutePlugin(plugin, name, args, []))
                );
            case ExecuteMode.None:
                await Promise.all(
                    plugins.map((plugin) => this.tryExecutePlugin(plugin, name, args, null))
                );
                return;
        }
    }

    private async tryExecutePlugin(plugin: any, fnName: string, args: any[], failValue: any) {
        try {
            return await plugin[fnName](...args);
        } catch (e) {
            Logger.error(e);
            return failValue;
        }
    }
}
