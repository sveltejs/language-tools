import {
    ApplyWorkspaceEditParams,
    ApplyWorkspaceEditRequest,
    CodeActionKind,
    DocumentUri,
    Connection,
    MessageType,
    RenameFile,
    RequestType,
    ShowMessageNotification,
    TextDocumentIdentifier,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    WorkspaceEdit,
    SemanticTokensRequest,
    SemanticTokensRangeRequest,
    DidChangeWatchedFilesParams,
    LinkedEditingRangeRequest,
    CallHierarchyPrepareRequest,
    CallHierarchyIncomingCallsRequest,
    CallHierarchyOutgoingCallsRequest,
    InlayHintRequest,
    SemanticTokensRefreshRequest,
    InlayHintRefreshRequest,
    DidChangeWatchedFilesNotification,
    RelativePattern
} from 'vscode-languageserver';
import { IPCMessageReader, IPCMessageWriter, createConnection } from 'vscode-languageserver/node';
import { DiagnosticsManager } from './lib/DiagnosticsManager';
import { Document, DocumentManager } from './lib/documents';
import { getSemanticTokenLegends } from './lib/semanticToken/semanticTokenLegend';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import {
    AppCompletionItem,
    CSSPlugin,
    HTMLPlugin,
    PluginHost,
    SveltePlugin,
    TypeScriptPlugin,
    OnWatchFileChangesPara,
    LSAndTSDocResolver
} from './plugins';
import { debounceThrottle, isNotNullOrUndefined, normalizeUri, urlToPath } from './utils';
import { FallbackWatcher } from './lib/FallbackWatcher';
import { configLoader } from './lib/documents/configLoader';
import { setIsTrusted } from './importPackage';
import { SORT_IMPORT_CODE_ACTION_KIND } from './plugins/typescript/features/CodeActionsProvider';
import { createLanguageServices } from './plugins/css/service';
import { FileSystemProvider } from './plugins/css/FileSystemProvider';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string | null, any> =
        new RequestType('html/tag');
}

export interface LSOptions {
    /**
     * If you have a connection already that the ls should use, pass it in.
     * Else the connection will be created from `process`.
     */
    connection?: Connection;
    /**
     * If you want only errors getting logged.
     * Defaults to false.
     */
    logErrorsOnly?: boolean;
}

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSOptions) {
    let connection = options?.connection;
    if (!connection) {
        if (process.argv.includes('--stdio')) {
            console.log = (...args: any[]) => {
                console.warn(...args);
            };
            connection = createConnection(process.stdin, process.stdout);
        } else {
            connection = createConnection(
                new IPCMessageReader(process),
                new IPCMessageWriter(process)
            );
        }
    }

    if (options?.logErrorsOnly !== undefined) {
        Logger.setLogErrorsOnly(options.logErrorsOnly);
    }

    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    const pluginHost = new PluginHost(docManager);
    let sveltePlugin: SveltePlugin = undefined as any;
    let watcher: FallbackWatcher | undefined;
    let pendingWatchPatterns: RelativePattern[] = [];
    let watchDirectory: (patterns: RelativePattern[]) => void = (patterns) => {
        pendingWatchPatterns = patterns;
    };

    // Include Svelte files to better deal with scenarios such as switching git branches
    // where files that are not opened in the client could change
    const watchExtensions = ['.ts', '.js', '.mts', '.mjs', '.cjs', '.cts', '.json', '.svelte'];
    const nonRecursiveWatchPattern =
        '*.{' + watchExtensions.map((ext) => ext.slice(1)).join(',') + '}';
    const recursiveWatchPattern = '**/' + nonRecursiveWatchPattern;

    connection.onInitialize((evt) => {
        const workspaceUris = evt.workspaceFolders?.map((folder) => folder.uri.toString()) ?? [
            evt.rootUri ?? ''
        ];
        Logger.log('Initialize language server at ', workspaceUris.join(', '));
        if (workspaceUris.length === 0) {
            Logger.error('No workspace path set');
        }

        if (!evt.capabilities.workspace?.didChangeWatchedFiles) {
            const workspacePaths = workspaceUris.map(urlToPath).filter(isNotNullOrUndefined);
            watcher = new FallbackWatcher(watchExtensions, workspacePaths);
            watcher.onDidChangeWatchedFiles(onDidChangeWatchedFiles);

            watchDirectory = (patterns) => {
                watcher?.watchDirectory(patterns);
            };
        }

        const isTrusted: boolean = evt.initializationOptions?.isTrusted ?? true;
        configLoader.setDisabled(!isTrusted);
        setIsTrusted(isTrusted);
        configManager.updateIsTrusted(isTrusted);
        if (!isTrusted) {
            Logger.log('Workspace is not trusted, running with reduced capabilities.');
        }

        Logger.setDebug(
            (evt.initializationOptions?.configuration?.svelte ||
                evt.initializationOptions?.config)?.['language-server']?.debug
        );
        // Backwards-compatible way of setting initialization options (first `||` is the old style)
        configManager.update(
            evt.initializationOptions?.configuration?.svelte?.plugin ||
                evt.initializationOptions?.config ||
                {}
        );
        configManager.updateTsJsUserPreferences(
            evt.initializationOptions?.configuration ||
                evt.initializationOptions?.typescriptConfig ||
                {}
        );
        configManager.updateTsJsFormateConfig(
            evt.initializationOptions?.configuration ||
                evt.initializationOptions?.typescriptConfig ||
                {}
        );
        configManager.updateEmmetConfig(
            evt.initializationOptions?.configuration?.emmet ||
                evt.initializationOptions?.emmetConfig ||
                {}
        );
        configManager.updatePrettierConfig(
            evt.initializationOptions?.configuration?.prettier ||
                evt.initializationOptions?.prettierConfig ||
                {}
        );
        // no old style as these were added later
        configManager.updateCssConfig(evt.initializationOptions?.configuration?.css);
        configManager.updateScssConfig(evt.initializationOptions?.configuration?.scss);
        configManager.updateLessConfig(evt.initializationOptions?.configuration?.less);
        configManager.updateHTMLConfig(evt.initializationOptions?.configuration?.html);
        configManager.updateClientCapabilities(evt.capabilities);

        pluginHost.initialize({
            filterIncompleteCompletions:
                !evt.initializationOptions?.dontFilterIncompleteCompletions,
            definitionLinkSupport: !!evt.capabilities.textDocument?.definition?.linkSupport
        });
        // Order of plugin registration matters for FirstNonNull, which affects for example hover info
        pluginHost.register((sveltePlugin = new SveltePlugin(configManager)));
        pluginHost.register(new HTMLPlugin(docManager, configManager));

        const cssLanguageServices = createLanguageServices({
            clientCapabilities: evt.capabilities,
            fileSystemProvider: new FileSystemProvider()
        });
        const workspaceFolders = evt.workspaceFolders ?? [{ name: '', uri: evt.rootUri ?? '' }];
        pluginHost.register(
            new CSSPlugin(docManager, configManager, workspaceFolders, cssLanguageServices)
        );
        const normalizedWorkspaceUris = workspaceUris.map(normalizeUri);
        pluginHost.register(
            new TypeScriptPlugin(
                configManager,
                new LSAndTSDocResolver(docManager, normalizedWorkspaceUris, configManager, {
                    notifyExceedSizeLimit: notifyTsServiceExceedSizeLimit,
                    onProjectReloaded: refreshCrossFilesSemanticFeatures,
                    watch: true,
                    nonRecursiveWatchPattern,
                    watchDirectory: (patterns) => watchDirectory(patterns),
                    reportConfigError(diagnostic) {
                        connection?.sendDiagnostics(diagnostic);
                    }
                }),
                normalizedWorkspaceUris,
                docManager
            )
        );

        const clientSupportApplyEditCommand = !!evt.capabilities.workspace?.applyEdit;
        const clientCodeActionCapabilities = evt.capabilities.textDocument?.codeAction;
        const clientSupportedCodeActionKinds =
            clientCodeActionCapabilities?.codeActionLiteralSupport?.codeActionKind.valueSet;

        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
                    save: {
                        includeText: false
                    }
                },
                hoverProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: [
                        '.',
                        '"',
                        "'",
                        '`',
                        '/',
                        '@',
                        '<',

                        // Emmet
                        '>',
                        '*',
                        '#',
                        '$',
                        '+',
                        '^',
                        '(',
                        '[',
                        '@',
                        '-',
                        // No whitespace because
                        // it makes for weird/too many completions
                        // of other completion providers

                        // Svelte
                        ':',
                        '|'
                    ],
                    completionItem: {
                        labelDetailsSupport: true
                    }
                },
                documentFormattingProvider: true,
                colorProvider: true,
                documentSymbolProvider: true,
                definitionProvider: true,
                codeActionProvider: clientCodeActionCapabilities?.codeActionLiteralSupport
                    ? {
                          codeActionKinds: [
                              CodeActionKind.QuickFix,
                              CodeActionKind.SourceOrganizeImports,
                              SORT_IMPORT_CODE_ACTION_KIND,
                              ...(clientSupportApplyEditCommand ? [CodeActionKind.Refactor] : [])
                          ].filter(
                              clientSupportedCodeActionKinds &&
                                  evt.initializationOptions?.shouldFilterCodeActionKind
                                  ? (kind) => clientSupportedCodeActionKinds.includes(kind)
                                  : () => true
                          ),
                          resolveProvider: true
                      }
                    : true,
                executeCommandProvider: clientSupportApplyEditCommand
                    ? {
                          commands: [
                              'function_scope_0',
                              'function_scope_1',
                              'function_scope_2',
                              'function_scope_3',
                              'constant_scope_0',
                              'constant_scope_1',
                              'constant_scope_2',
                              'constant_scope_3',
                              'extract_to_svelte_component',
                              'migrate_to_svelte_5',
                              'Infer function return type'
                          ]
                      }
                    : undefined,
                renameProvider: evt.capabilities.textDocument?.rename?.prepareSupport
                    ? { prepareProvider: true }
                    : true,
                referencesProvider: true,
                selectionRangeProvider: true,
                signatureHelpProvider: {
                    triggerCharacters: ['(', ',', '<'],
                    retriggerCharacters: [')']
                },
                semanticTokensProvider: {
                    legend: getSemanticTokenLegends(),
                    range: true,
                    full: true
                },
                linkedEditingRangeProvider: true,
                implementationProvider: true,
                typeDefinitionProvider: true,
                inlayHintProvider: true,
                callHierarchyProvider: true,
                foldingRangeProvider: true,
                codeLensProvider: {
                    resolveProvider: true
                }
            }
        };
    });

    connection.onInitialized(() => {
        if (watcher) {
            return;
        }

        const didChangeWatchedFiles =
            configManager.getClientCapabilities()?.workspace?.didChangeWatchedFiles;

        if (!didChangeWatchedFiles?.dynamicRegistration) {
            return;
        }

        // still watch the roots since some files might be referenced but not included in the project
        connection?.client.register(DidChangeWatchedFilesNotification.type, {
            watchers: [
                {
                    // Editors have exclude configs, such as VSCode with `files.watcherExclude`,
                    // which means it's safe to watch recursively here
                    globPattern: recursiveWatchPattern
                }
            ]
        });

        if (didChangeWatchedFiles.relativePatternSupport) {
            watchDirectory = (patterns) => {
                connection?.client.register(DidChangeWatchedFilesNotification.type, {
                    watchers: patterns.map((pattern) => ({
                        globPattern: pattern
                    }))
                });
            };
            if (pendingWatchPatterns.length) {
                watchDirectory(pendingWatchPatterns);
                pendingWatchPatterns = [];
            }
        }
    });

    function notifyTsServiceExceedSizeLimit() {
        connection?.sendNotification(ShowMessageNotification.type, {
            message:
                'Svelte language server detected a large amount of JS/Svelte files. ' +
                'To enable project-wide JavaScript/TypeScript language features for Svelte files, ' +
                'exclude large folders in the tsconfig.json or jsconfig.json with source files that you do not work on.',
            type: MessageType.Warning
        });
    }

    connection.onExit(() => {
        watcher?.dispose();
    });

    connection.onRenameRequest((req) =>
        pluginHost.rename(req.textDocument, req.position, req.newName)
    );
    connection.onPrepareRename((req) => pluginHost.prepareRename(req.textDocument, req.position));

    connection.onDidChangeConfiguration(({ settings }) => {
        configManager.update(settings.svelte?.plugin);
        configManager.updateTsJsUserPreferences(settings);
        configManager.updateTsJsFormateConfig(settings);
        configManager.updateEmmetConfig(settings.emmet);
        configManager.updatePrettierConfig(settings.prettier);
        configManager.updateCssConfig(settings.css);
        configManager.updateScssConfig(settings.scss);
        configManager.updateLessConfig(settings.less);
        configManager.updateHTMLConfig(settings.html);
        Logger.setDebug(settings.svelte?.['language-server']?.debug);
    });

    connection.onDidOpenTextDocument((evt) => {
        const document = docManager.openClientDocument(evt.textDocument);
        diagnosticsManager.scheduleUpdate(document);
    });

    connection.onDidCloseTextDocument((evt) => docManager.closeDocument(evt.textDocument.uri));
    connection.onDidChangeTextDocument((evt) => {
        diagnosticsManager.cancelStarted(evt.textDocument.uri);
        docManager.updateDocument(evt.textDocument, evt.contentChanges);
        pluginHost.didUpdateDocument();
    });
    connection.onHover((evt) => pluginHost.doHover(evt.textDocument, evt.position));
    connection.onCompletion((evt, cancellationToken) =>
        pluginHost.getCompletions(evt.textDocument, evt.position, evt.context, cancellationToken)
    );
    connection.onDocumentFormatting((evt) =>
        pluginHost.formatDocument(evt.textDocument, evt.options)
    );
    connection.onRequest(TagCloseRequest.type, (evt) =>
        pluginHost.doTagComplete(evt.textDocument, evt.position)
    );
    connection.onDocumentColor((evt) => pluginHost.getDocumentColors(evt.textDocument));
    connection.onColorPresentation((evt) =>
        pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color)
    );
    connection.onDocumentSymbol((evt, cancellationToken) =>
        pluginHost.getDocumentSymbols(evt.textDocument, cancellationToken)
    );
    connection.onDefinition((evt) => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onReferences((evt, cancellationToken) =>
        pluginHost.findReferences(evt.textDocument, evt.position, evt.context, cancellationToken)
    );

    connection.onCodeAction((evt, cancellationToken) =>
        pluginHost.getCodeActions(evt.textDocument, evt.range, evt.context, cancellationToken)
    );
    connection.onExecuteCommand(async (evt) => {
        const result = await pluginHost.executeCommand(
            { uri: evt.arguments?.[0] },
            evt.command,
            evt.arguments
        );
        if (WorkspaceEdit.is(result)) {
            const edit: ApplyWorkspaceEditParams = { edit: result };
            connection?.sendRequest(ApplyWorkspaceEditRequest.type.method, edit);
        } else if (result) {
            connection?.sendNotification(ShowMessageNotification.type.method, {
                message: result,
                type: MessageType.Error
            });
        }
    });
    connection.onCodeActionResolve((codeAction, cancellationToken) => {
        const data = codeAction.data as TextDocumentIdentifier;
        return pluginHost.resolveCodeAction(data, codeAction, cancellationToken);
    });

    connection.onCompletionResolve((completionItem, cancellationToken) => {
        const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

        if (!data) {
            return completionItem;
        }

        return pluginHost.resolveCompletion(data, completionItem, cancellationToken);
    });

    connection.onSignatureHelp((evt, cancellationToken) =>
        pluginHost.getSignatureHelp(evt.textDocument, evt.position, evt.context, cancellationToken)
    );

    connection.onSelectionRanges((evt) =>
        pluginHost.getSelectionRanges(evt.textDocument, evt.positions)
    );

    connection.onImplementation((evt, cancellationToken) =>
        pluginHost.getImplementation(evt.textDocument, evt.position, cancellationToken)
    );

    connection.onTypeDefinition((evt) =>
        pluginHost.getTypeDefinition(evt.textDocument, evt.position)
    );

    connection.onFoldingRanges((evt) => pluginHost.getFoldingRanges(evt.textDocument));

    connection.onCodeLens((evt) => pluginHost.getCodeLens(evt.textDocument));
    connection.onCodeLensResolve((codeLens, token) => {
        const data = codeLens.data as TextDocumentIdentifier;

        if (!data) {
            return codeLens;
        }

        return pluginHost.resolveCodeLens(data, codeLens, token);
    });

    const diagnosticsManager = new DiagnosticsManager(
        connection.sendDiagnostics,
        docManager,
        pluginHost.getDiagnostics.bind(pluginHost)
    );

    const refreshSemanticTokens = debounceThrottle(() => {
        if (configManager?.getClientCapabilities()?.workspace?.semanticTokens?.refreshSupport) {
            connection?.sendRequest(SemanticTokensRefreshRequest.method);
        }
    }, 1500);

    const refreshInlayHints = debounceThrottle(() => {
        if (configManager?.getClientCapabilities()?.workspace?.inlayHint?.refreshSupport) {
            connection?.sendRequest(InlayHintRefreshRequest.method);
        }
    }, 1500);

    const refreshCrossFilesSemanticFeatures = () => {
        diagnosticsManager.scheduleUpdateAll();
        refreshInlayHints();
        refreshSemanticTokens();
    };

    connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
    function onDidChangeWatchedFiles(para: DidChangeWatchedFilesParams) {
        const onWatchFileChangesParas = para.changes
            .map((change) => ({
                fileName: urlToPath(change.uri),
                changeType: change.type
            }))
            .filter((change): change is OnWatchFileChangesPara => !!change.fileName);

        pluginHost.onWatchFileChanges(onWatchFileChangesParas);

        refreshCrossFilesSemanticFeatures();
    }

    connection.onDidSaveTextDocument(diagnosticsManager.scheduleUpdateAll.bind(diagnosticsManager));
    connection.onNotification('$/onDidChangeTsOrJsFile', async (e: any) => {
        const path = urlToPath(e.uri);
        if (path) {
            pluginHost.updateTsOrJsFile(path, e.changes);
        }

        refreshCrossFilesSemanticFeatures();
    });

    connection.onRequest(SemanticTokensRequest.type, (evt, cancellationToken) =>
        pluginHost.getSemanticTokens(evt.textDocument, undefined, cancellationToken)
    );
    connection.onRequest(SemanticTokensRangeRequest.type, (evt, cancellationToken) =>
        pluginHost.getSemanticTokens(evt.textDocument, evt.range, cancellationToken)
    );

    connection.onRequest(
        LinkedEditingRangeRequest.type,
        async (evt) => await pluginHost.getLinkedEditingRanges(evt.textDocument, evt.position)
    );

    connection.onRequest(InlayHintRequest.type, (evt, cancellationToken) =>
        pluginHost.getInlayHints(evt.textDocument, evt.range, cancellationToken)
    );

    connection.onRequest(
        CallHierarchyPrepareRequest.type,
        async (evt, token) =>
            await pluginHost.prepareCallHierarchy(evt.textDocument, evt.position, token)
    );

    connection.onRequest(
        CallHierarchyIncomingCallsRequest.type,
        async (evt, token) => await pluginHost.getIncomingCalls(evt.item, token)
    );

    connection.onRequest(
        CallHierarchyOutgoingCallsRequest.type,
        async (evt, token) => await pluginHost.getOutgoingCalls(evt.item, token)
    );

    docManager.on('documentChange', diagnosticsManager.scheduleUpdate.bind(diagnosticsManager));
    docManager.on('documentClose', (document: Document) =>
        diagnosticsManager.removeDiagnostics(document)
    );

    // The language server protocol does not have a specific "did rename/move files" event,
    // so we create our own in the extension client and handle it here
    connection.onRequest('$/getEditsForFileRename', async (fileRename: RenameFile) =>
        pluginHost.updateImports(fileRename)
    );

    connection.onRequest('$/getFileReferences', async (uri: string) => {
        return pluginHost.fileReferences(uri);
    });

    connection.onRequest('$/getComponentReferences', async (uri: string) => {
        return pluginHost.findComponentReferences(uri);
    });

    connection.onRequest('$/getCompiledCode', async (uri: DocumentUri) => {
        const doc = docManager.get(uri);
        if (!doc) {
            return null;
        }

        const compiled = await sveltePlugin.getCompiledResult(doc);
        if (compiled) {
            const js = compiled.js;
            const css = compiled.css;
            return { js, css };
        } else {
            return null;
        }
    });

    connection.listen();
}
