import { flatten } from 'lodash';
import { performance } from 'perf_hooks';
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeLens,
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionContext,
    CompletionItem,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    FoldingRange,
    FormattingOptions,
    Hover,
    LinkedEditingRanges,
    Location,
    Position,
    Range,
    ReferenceContext,
    SelectionRange,
    SemanticTokens,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    TextDocumentContentChangeEvent,
    TextDocumentIdentifier,
    TextEdit,
    WorkspaceEdit,
    InlayHint
} from 'vscode-languageserver';
import { DocumentManager, getNodeIfIsInHTMLStartTag } from '../lib/documents';
import { Logger } from '../logger';
import { isNotNullOrUndefined, regexLastIndexOf } from '../utils';
import {
    AppCompletionItem,
    FileRename,
    LSPProviderConfig,
    LSProvider,
    OnWatchFileChanges,
    OnWatchFileChangesPara,
    Plugin
} from './interfaces';

enum ExecuteMode {
    None,
    FirstNonNull,
    Collect
}

export class PluginHost implements LSProvider, OnWatchFileChanges {
    private plugins: Plugin[] = [];
    private pluginHostConfig: LSPProviderConfig = {
        filterIncompleteCompletions: true,
        definitionLinkSupport: false
    };
    private deferredRequests: Record<string, [number, Promise<any>]> = {};
    private requestTimings: Record<string, [time: number, lastExecuted: number]> = {};

    constructor(private documentsManager: DocumentManager) {}

    initialize(pluginHostConfig: LSPProviderConfig) {
        this.pluginHostConfig = pluginHostConfig;
    }

    register(plugin: Plugin) {
        this.plugins.push(plugin);
    }

    didUpdateDocument() {
        this.deferredRequests = {};
    }

    async getDiagnostics(
        textDocument: TextDocumentIdentifier,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        const document = this.getDocument(textDocument.uri);

        if (
            (document.getFilePath()?.includes('/node_modules/') ||
                document.getFilePath()?.includes('\\node_modules\\')) &&
            // Sapper convention: Put stuff inside node_modules below src
            !(
                document.getFilePath()?.includes('/src/node_modules/') ||
                document.getFilePath()?.includes('\\src\\node_modules\\')
            )
        ) {
            // Don't return diagnostics for files inside node_modules. These are considered read-only (cannot be changed)
            // and in case of svelte-check they would pollute/skew the output
            return [];
        }

        return flatten(
            await this.execute<Diagnostic[]>(
                'getDiagnostics',
                [document, cancellationToken],
                ExecuteMode.Collect,
                'high'
            )
        );
    }

    async doHover(textDocument: TextDocumentIdentifier, position: Position): Promise<Hover | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<Hover>(
            'doHover',
            [document, position],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async getCompletions(
        textDocument: TextDocumentIdentifier,
        position: Position,
        completionContext?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<CompletionList> {
        const document = this.getDocument(textDocument.uri);

        const completions = await Promise.all(
            this.plugins.map(async (plugin) => {
                const result = await this.tryExecutePlugin(
                    plugin,
                    'getCompletions',
                    [document, position, completionContext, cancellationToken],
                    null
                );
                if (result) {
                    return { result: result as CompletionList, plugin: plugin.__name };
                }
            })
        ).then((completions) => completions.filter(isNotNullOrUndefined));

        const html = completions.find((completion) => completion.plugin === 'html');
        const ts = completions.find((completion) => completion.plugin === 'ts');
        if (html && ts && getNodeIfIsInHTMLStartTag(document.html, document.offsetAt(position))) {
            // Completion in a component or html start tag and both html and ts
            // suggest something -> filter out all duplicates from TS completions
            const htmlCompletions = new Set(html.result.items.map((item) => item.label));
            ts.result.items = ts.result.items.filter((item) => {
                const label = item.label;
                if (htmlCompletions.has(label)) {
                    return false;
                }
                if (label[0] === '"' && label[label.length - 1] === '"') {
                    // this will result in a wrong completion regardless, remove the quotes
                    item.label = item.label.slice(1, -1);
                    if (htmlCompletions.has(item.label)) {
                        // "aria-label" -> aria-label -> exists in html completions
                        return false;
                    }
                }
                if (label.startsWith('on')) {
                    if (htmlCompletions.has('on:' + label.slice(2))) {
                        // onclick -> on:click -> exists in html completions
                        return false;
                    }
                }
                // adjust sort text so it does appear after html completions
                item.sortText = 'Z' + (item.sortText || '');
                return true;
            });
        }

        let itemDefaults: CompletionList['itemDefaults'];
        if (completions.length === 1) {
            itemDefaults = completions[0]?.result.itemDefaults;
        } else {
            // don't apply items default to the result of other plugins
            for (const completion of completions) {
                const itemDefaults = completion.result.itemDefaults;
                if (!itemDefaults) {
                    continue;
                }
                completion.result.items.forEach((item) => {
                    item.commitCharacters ??= itemDefaults.commitCharacters;
                });
            }
        }

        let flattenedCompletions = flatten(
            completions.map((completion) => completion.result.items)
        );
        const isIncomplete = completions.reduce(
            (incomplete, completion) => incomplete || completion.result.isIncomplete,
            false as boolean
        );

        // If the result is incomplete, we need to filter the results ourselves
        // to throw out non-matching results. VSCode does filter client-side,
        // but other IDEs might not.
        if (isIncomplete && this.pluginHostConfig.filterIncompleteCompletions) {
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

        const result = CompletionList.create(flattenedCompletions, isIncomplete);
        result.itemDefaults = itemDefaults;

        return result;
    }

    async resolveCompletion(
        textDocument: TextDocumentIdentifier,
        completionItem: AppCompletionItem,
        cancellationToken: CancellationToken
    ): Promise<CompletionItem> {
        const document = this.getDocument(textDocument.uri);

        const result = await this.execute<CompletionItem>(
            'resolveCompletion',
            [document, completionItem, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );

        return result ?? completionItem;
    }

    async formatDocument(
        textDocument: TextDocumentIdentifier,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const document = this.getDocument(textDocument.uri);

        return flatten(
            await this.execute<TextEdit[]>(
                'formatDocument',
                [document, options],
                ExecuteMode.Collect,
                'high'
            )
        );
    }

    async doTagComplete(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<string | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<string | null>(
            'doTagComplete',
            [document, position],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async getDocumentColors(textDocument: TextDocumentIdentifier): Promise<ColorInformation[]> {
        const document = this.getDocument(textDocument.uri);

        return flatten(
            await this.execute<ColorInformation[]>(
                'getDocumentColors',
                [document],
                ExecuteMode.Collect,
                'low'
            )
        );
    }

    async getColorPresentations(
        textDocument: TextDocumentIdentifier,
        range: Range,
        color: Color
    ): Promise<ColorPresentation[]> {
        const document = this.getDocument(textDocument.uri);

        return flatten(
            await this.execute<ColorPresentation[]>(
                'getColorPresentations',
                [document, range, color],
                ExecuteMode.Collect,
                'high'
            )
        );
    }

    async getDocumentSymbols(
        textDocument: TextDocumentIdentifier,
        cancellationToken: CancellationToken
    ): Promise<SymbolInformation[]> {
        const document = this.getDocument(textDocument.uri);

        // VSCode requested document symbols twice for the outline view and the sticky scroll
        // Manually delay here and don't use low priority as one of them will return no symbols
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancellationToken.isCancellationRequested) {
            return [];
        }
        return flatten(
            await this.execute<SymbolInformation[]>(
                'getDocumentSymbols',
                [document, cancellationToken],
                ExecuteMode.Collect,
                'high'
            )
        );
    }

    async getDefinitions(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<DefinitionLink[] | Location[]> {
        const document = this.getDocument(textDocument.uri);

        const definitions = flatten(
            await this.execute<DefinitionLink[]>(
                'getDefinitions',
                [document, position],
                ExecuteMode.Collect,
                'high'
            )
        );

        if (this.pluginHostConfig.definitionLinkSupport) {
            return definitions;
        } else {
            return definitions.map(
                (def) => <Location>{ range: def.targetSelectionRange, uri: def.targetUri }
            );
        }
    }

    async getCodeActions(
        textDocument: TextDocumentIdentifier,
        range: Range,
        context: CodeActionContext,
        cancellationToken: CancellationToken
    ): Promise<CodeAction[]> {
        const document = this.getDocument(textDocument.uri);

        const actions = flatten(
            await this.execute<CodeAction[]>(
                'getCodeActions',
                [document, range, context, cancellationToken],
                ExecuteMode.Collect,
                'high'
            )
        );
        // Sort Svelte actions below other actions as they are often less relevant
        actions.sort((a, b) => {
            const aPrio = a.title.startsWith('(svelte)') ? 1 : 0;
            const bPrio = b.title.startsWith('(svelte)') ? 1 : 0;
            return aPrio - bPrio;
        });
        return actions;
    }

    async executeCommand(
        textDocument: TextDocumentIdentifier,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<WorkspaceEdit>(
            'executeCommand',
            [document, command, args],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async resolveCodeAction(
        textDocument: TextDocumentIdentifier,
        codeAction: CodeAction,
        cancellationToken: CancellationToken
    ): Promise<CodeAction> {
        const document = this.getDocument(textDocument.uri);

        const result = await this.execute<CodeAction>(
            'resolveCodeAction',
            [document, codeAction, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );

        return result ?? codeAction;
    }

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        return await this.execute<WorkspaceEdit>(
            'updateImports',
            [fileRename],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async prepareRename(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<Range | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<any>(
            'prepareRename',
            [document, position],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async rename(
        textDocument: TextDocumentIdentifier,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<any>(
            'rename',
            [document, position, newName],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async findReferences(
        textDocument: TextDocumentIdentifier,
        position: Position,
        context: ReferenceContext,
        cancellationToken?: CancellationToken
    ): Promise<Location[] | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<any>(
            'findReferences',
            [document, position, context, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async fileReferences(uri: string): Promise<Location[] | null> {
        return await this.execute<any>('fileReferences', [uri], ExecuteMode.FirstNonNull, 'high');
    }

    async findComponentReferences(uri: string): Promise<Location[] | null> {
        return await this.execute<any>(
            'findComponentReferences',
            [uri],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async getSignatureHelp(
        textDocument: TextDocumentIdentifier,
        position: Position,
        context: SignatureHelpContext | undefined,
        cancellationToken: CancellationToken
    ): Promise<SignatureHelp | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<any>(
            'getSignatureHelp',
            [document, position, context, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
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

        try {
            return Promise.all(
                positions.map(async (position) => {
                    for (const plugin of this.plugins) {
                        const range = await plugin.getSelectionRange?.(document, position);

                        if (range) {
                            return range;
                        }
                    }
                    return SelectionRange.create(Range.create(position, position));
                })
            );
        } catch (error) {
            Logger.error(error);
            return null;
        }
    }

    async getSemanticTokens(
        textDocument: TextDocumentIdentifier,
        range?: Range,
        cancellationToken?: CancellationToken
    ) {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<SemanticTokens>(
            'getSemanticTokens',
            [document, range, cancellationToken],
            ExecuteMode.FirstNonNull,
            'smart'
        );
    }

    async getLinkedEditingRanges(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<LinkedEditingRanges | null> {
        const document = this.getDocument(textDocument.uri);

        return await this.execute<LinkedEditingRanges>(
            'getLinkedEditingRanges',
            [document, position],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    getImplementation(
        textDocument: TextDocumentIdentifier,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<Location[] | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<Location[] | null>(
            'getImplementation',
            [document, position, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    getTypeDefinition(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<Location[] | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<Location[] | null>(
            'getTypeDefinition',
            [document, position],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    getInlayHints(
        textDocument: TextDocumentIdentifier,
        range: Range,
        cancellationToken?: CancellationToken
    ): Promise<InlayHint[] | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<InlayHint[] | null>(
            'getInlayHints',
            [document, range, cancellationToken],
            ExecuteMode.FirstNonNull,
            'smart'
        );
    }

    prepareCallHierarchy(
        textDocument: TextDocumentIdentifier,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<CallHierarchyItem[] | null> {
        const document = this.getDocument(textDocument.uri);

        return this.execute<CallHierarchyItem[] | null>(
            'prepareCallHierarchy',
            [document, position, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    getIncomingCalls(
        item: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyIncomingCall[] | null> {
        return this.execute<CallHierarchyIncomingCall[] | null>(
            'getIncomingCalls',
            [item, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    getOutgoingCalls(
        item: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyOutgoingCall[] | null> {
        return this.execute<CallHierarchyOutgoingCall[] | null>(
            'getOutgoingCalls',
            [item, cancellationToken],
            ExecuteMode.FirstNonNull,
            'high'
        );
    }

    async getCodeLens(textDocument: TextDocumentIdentifier) {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        const result = await this.execute<CodeLens[]>(
            'getCodeLens',
            [document],
            ExecuteMode.Collect,
            'smart'
        );
        return flatten(result.filter(Boolean));
    }

    async getFoldingRanges(textDocument: TextDocumentIdentifier): Promise<FoldingRange[]> {
        const document = this.getDocument(textDocument.uri);

        const result = flatten(
            await this.execute<FoldingRange[]>(
                'getFoldingRanges',
                [document],
                ExecuteMode.Collect,
                'high'
            )
        );

        return result;
    }

    async resolveCodeLens(
        textDocument: TextDocumentIdentifier,
        codeLens: CodeLens,
        cancellationToken: CancellationToken
    ) {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        return (
            (await this.execute<CodeLens>(
                'resolveCodeLens',
                [document, codeLens, cancellationToken],
                ExecuteMode.FirstNonNull,
                'smart'
            )) ?? codeLens
        );
    }

    onWatchFileChanges(onWatchFileChangesParas: OnWatchFileChangesPara[]): void {
        for (const support of this.plugins) {
            support.onWatchFileChanges?.(onWatchFileChangesParas);
        }
    }

    updateTsOrJsFile(fileName: string, changes: TextDocumentContentChangeEvent[]): void {
        for (const support of this.plugins) {
            support.updateTsOrJsFile?.(fileName, changes);
        }
    }

    private getDocument(uri: string) {
        const document = this.documentsManager.get(uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }
        return document;
    }

    private execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode.FirstNonNull,
        priority: 'low' | 'high' | 'smart'
    ): Promise<T | null>;
    private execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode.Collect,
        priority: 'low' | 'high' | 'smart'
    ): Promise<T[]>;
    private execute(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode.None,
        priority: 'low' | 'high' | 'smart'
    ): Promise<void>;
    private async execute<T>(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode,
        priority: 'low' | 'high' | 'smart'
    ): Promise<(T | null) | T[] | void> {
        const plugins = this.plugins.filter((plugin) => typeof plugin[name] === 'function');
        // Priority 'smart' tries to aproximate how much time a method takes to execute,
        // making it low priority if it takes too long or if it seems like other methods do.
        const now = performance.now();
        if (
            priority === 'smart' &&
            (this.requestTimings[name]?.[0] > 500 ||
                Object.values(this.requestTimings).filter(
                    (t) => t[0] > 400 && now - t[1] < 60 * 1000
                ).length > 2)
        ) {
            Logger.debug(`Executing next invocation of "${name}" with low priority`);
            priority = 'low';
            if (this.requestTimings[name]) {
                this.requestTimings[name][0] = this.requestTimings[name][0] / 2 + 150;
            }
        }

        if (priority === 'low') {
            // If a request doesn't have priority, we first wait 1 second to
            // 1. let higher priority requests get through first
            // 2. wait for possible document changes, which make the request wait again
            // Due to waiting, low priority items should preferrably be those who do not
            // rely on positions or ranges and rather on the whole document only.
            const debounce = async (): Promise<boolean> => {
                const id = Math.random();
                this.deferredRequests[name] = [
                    id,
                    new Promise<void>((resolve, reject) => {
                        setTimeout(() => {
                            if (
                                !this.deferredRequests[name] ||
                                this.deferredRequests[name][0] === id
                            ) {
                                resolve();
                            } else {
                                // We should not get into this case. According to the spec,
                                // the language client does not send another request
                                // of the same type until the previous one is answered.
                                reject();
                            }
                        }, 1000);
                    })
                ];
                try {
                    await this.deferredRequests[name][1];
                    if (!this.deferredRequests[name]) {
                        return debounce();
                    }
                    return true;
                } catch (e) {
                    return false;
                }
            };
            const shouldContinue = await debounce();
            if (!shouldContinue) {
                return;
            }
        }

        const startTime = performance.now();
        const result = await this.executePlugins(name, args, mode, plugins);
        this.requestTimings[name] = [performance.now() - startTime, startTime];
        return result;
    }

    private async executePlugins(
        name: keyof LSProvider,
        args: any[],
        mode: ExecuteMode,
        plugins: Plugin[]
    ) {
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
