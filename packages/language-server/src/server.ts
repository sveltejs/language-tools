import _ from 'lodash';
import {
    ApplyWorkspaceEditParams,
    ApplyWorkspaceEditRequest,
    CodeActionKind,
    createConnection,
    DocumentUri,
    IConnection,
    IPCMessageReader,
    IPCMessageWriter,
    MessageType,
    RenameFile,
    RequestType,
    ShowMessageNotification,
    TextDocumentIdentifier,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    WorkspaceEdit
} from 'vscode-languageserver';
import { DiagnosticsManager } from './lib/DiagnosticsManager';
import { Document, DocumentManager } from './lib/documents';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import {
    AppCompletionItem,
    CSSPlugin,
    HTMLPlugin,
    PluginHost,
    SveltePlugin,
    TypeScriptPlugin,
    OnWatchFileChangesPara
} from './plugins';
import { urlToPath } from './utils';

namespace TagCloseRequest {
    export const type: RequestType<
        TextDocumentPositionParams,
        string | null,
        any,
        any
    > = new RequestType('html/tag');
}

export interface LSOptions {
    /**
     * If you have a connection already that the ls should use, pass it in.
     * Else the connection will be created from `process`.
     */
    connection?: IConnection;
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

    connection.onInitialize((evt) => {
        const workspaceUris = evt.workspaceFolders?.map((folder) => folder.uri.toString()) ?? [
            evt.rootUri ?? ''
        ];
        Logger.log('Initialize language server at ', workspaceUris.join(', '));
        if (workspaceUris.length === 0) {
            Logger.error('No workspace path set');
        }

        configManager.update(evt.initializationOptions?.config || {});
        configManager.updateTsJsUserPreferences(evt.initializationOptions?.typescriptConfig || {});
        configManager.updateEmmetConfig(evt.initializationOptions?.emmetConfig || {});
        configManager.updatePrettierConfig(evt.initializationOptions?.prettierConfig || {});

        pluginHost.initialize({
            filterIncompleteCompletions: !evt.initializationOptions
                ?.dontFilterIncompleteCompletions,
            definitionLinkSupport: !!evt.capabilities.textDocument?.definition?.linkSupport
        });
        pluginHost.register((sveltePlugin = new SveltePlugin(configManager)));
        pluginHost.register(new HTMLPlugin(docManager, configManager));
        pluginHost.register(new CSSPlugin(docManager, configManager));
        pluginHost.register(new TypeScriptPlugin(docManager, configManager, workspaceUris));

        const clientSupportApplyEditCommand = !!evt.capabilities.workspace?.applyEdit;

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
                        ':'
                    ]
                },
                documentFormattingProvider: true,
                colorProvider: true,
                documentSymbolProvider: true,
                definitionProvider: true,
                codeActionProvider: evt.capabilities.textDocument?.codeAction
                    ?.codeActionLiteralSupport
                    ? {
                          codeActionKinds: [
                              CodeActionKind.QuickFix,
                              CodeActionKind.SourceOrganizeImports,
                              ...(clientSupportApplyEditCommand ? [CodeActionKind.Refactor] : [])
                          ]
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
                              'extract_to_svelte_component'
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
                }
            }
        };
    });

    connection.onRenameRequest((req) =>
        pluginHost.rename(req.textDocument, req.position, req.newName)
    );
    connection.onPrepareRename((req) => pluginHost.prepareRename(req.textDocument, req.position));

    connection.onDidChangeConfiguration(({ settings }) => {
        configManager.update(settings.svelte?.plugin);
        configManager.updateTsJsUserPreferences(settings);
        configManager.updateEmmetConfig(settings.emmet);
        configManager.updatePrettierConfig(settings.prettier);
    });

    connection.onDidOpenTextDocument((evt) => {
        docManager.openDocument(evt.textDocument);
        docManager.markAsOpenedInClient(evt.textDocument.uri);
    });

    connection.onDidCloseTextDocument((evt) => docManager.closeDocument(evt.textDocument.uri));
    connection.onDidChangeTextDocument((evt) =>
        docManager.updateDocument(evt.textDocument, evt.contentChanges)
    );
    connection.onHover((evt) => pluginHost.doHover(evt.textDocument, evt.position));
    connection.onCompletion((evt) =>
        pluginHost.getCompletions(evt.textDocument, evt.position, evt.context)
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
    connection.onDocumentSymbol((evt) => pluginHost.getDocumentSymbols(evt.textDocument));
    connection.onDefinition((evt) => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onReferences((evt) =>
        pluginHost.findReferences(evt.textDocument, evt.position, evt.context)
    );

    connection.onCodeAction((evt) =>
        pluginHost.getCodeActions(evt.textDocument, evt.range, evt.context)
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

    connection.onCompletionResolve((completionItem) => {
        const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

        if (!data) {
            return completionItem;
        }

        return pluginHost.resolveCompletion(data, completionItem);
    });

    connection.onSignatureHelp((evt) =>
        pluginHost.getSignatureHelp(evt.textDocument, evt.position, evt.context)
    );

    connection.onSelectionRanges((evt) =>
        pluginHost.getSelectionRanges(evt.textDocument, evt.positions)
    );

    const diagnosticsManager = new DiagnosticsManager(
        connection.sendDiagnostics,
        docManager,
        pluginHost.getDiagnostics.bind(pluginHost)
    );

    connection.onDidChangeWatchedFiles((para) => {
        const onWatchFileChangesParas = para.changes
            .map((change) => ({
                fileName: urlToPath(change.uri),
                changeType: change.type
            }))
            .filter((change): change is OnWatchFileChangesPara => !!change.fileName);

        pluginHost.onWatchFileChanges(onWatchFileChangesParas);

        diagnosticsManager.updateAll();
    });
    connection.onDidSaveTextDocument(() => diagnosticsManager.updateAll());

    docManager.on(
        'documentChange',
        _.debounce(async (document: Document) => diagnosticsManager.update(document), 500)
    );
    docManager.on('documentClose', (document: Document) =>
        diagnosticsManager.removeDiagnostics(document)
    );

    // The language server protocol does not have a specific "did rename/move files" event,
    // so we create our own in the extension client and handle it here
    connection.onRequest('$/getEditsForFileRename', async (fileRename: RenameFile) =>
        pluginHost.updateImports(fileRename)
    );

    connection.onRequest('$/getCompiledCode', async (uri: DocumentUri) => {
        const doc = docManager.get(uri);
        if (!doc) return null;

        if (doc) {
            const compiled = await sveltePlugin.getCompiledResult(doc);
            if (compiled) {
                const js = compiled.js;
                const css = compiled.css;
                return { js, css };
            } else {
                return null;
            }
        }
    });

    connection.listen();
}
