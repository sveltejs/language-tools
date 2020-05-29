import {
    createConnection,
    IPCMessageReader,
    IPCMessageWriter,
    TextDocumentSyncKind,
    RequestType,
    TextDocumentPositionParams,
    TextDocumentIdentifier,
    IConnection,
    CodeActionKind,
    RenameFile,
} from 'vscode-languageserver';
import { DocumentManager, Document } from './lib/documents';
import {
    SveltePlugin,
    HTMLPlugin,
    CSSPlugin,
    TypeScriptPlugin,
    PluginHost,
    AppCompletionItem,
} from './plugins';
import _ from 'lodash';
import { LSConfigManager } from './ls-config';
import { urlToPath } from './utils';
import { Logger } from './logger';

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
        connection = process.argv.includes('--stdio')
            ? createConnection(process.stdin, process.stdout)
            : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
    }

    if (options?.logErrorsOnly !== undefined) {
        Logger.setLogErrorsOnly(options.logErrorsOnly);
    }

    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text),
    );
    const configManager = new LSConfigManager();
    const pluginHost = new PluginHost(docManager, configManager);

    connection.onInitialize((evt) => {
        const workspacePath = urlToPath(evt.rootUri || '') || '';
        Logger.log('Initialize language server in ', workspacePath);

        pluginHost.updateConfig(evt.initializationOptions?.config);
        pluginHost.register(new SveltePlugin(configManager));
        pluginHost.register(new HTMLPlugin(docManager, configManager));
        pluginHost.register(new CSSPlugin(docManager, configManager));
        pluginHost.register(new TypeScriptPlugin(docManager, configManager, workspacePath));

        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
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

                        // For Emmet
                        '>',
                        '*',
                        '#',
                        '$',
                        ' ',
                        '+',
                        '^',
                        '(',
                        '[',
                        '@',
                        '-',

                        // Svelte
                        ':',
                    ],
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
                          ],
                      }
                    : true,
            },
        };
    });

    connection.onDidChangeConfiguration(({ settings }) => {
        pluginHost.updateConfig(settings.svelte?.plugin);
    });

    connection.onDidOpenTextDocument((evt) => docManager.openDocument(evt.textDocument));
    connection.onDidCloseTextDocument((evt) => docManager.closeDocument(evt.textDocument.uri));
    connection.onDidChangeTextDocument((evt) =>
        docManager.updateDocument(evt.textDocument, evt.contentChanges),
    );
    connection.onHover((evt) => pluginHost.doHover(evt.textDocument, evt.position));
    connection.onCompletion((evt) =>
        pluginHost.getCompletions(evt.textDocument, evt.position, evt.context),
    );
    connection.onDocumentFormatting((evt) => pluginHost.formatDocument(evt.textDocument));
    connection.onRequest(TagCloseRequest.type, (evt) =>
        pluginHost.doTagComplete(evt.textDocument, evt.position),
    );
    connection.onDocumentColor((evt) => pluginHost.getDocumentColors(evt.textDocument));
    connection.onColorPresentation((evt) =>
        pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color),
    );
    connection.onDocumentSymbol((evt) => pluginHost.getDocumentSymbols(evt.textDocument));
    connection.onDefinition((evt) => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onCodeAction((evt) =>
        pluginHost.getCodeActions(evt.textDocument, evt.range, evt.context),
    );
    connection.onCompletionResolve((completionItem) => {
        const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

        if (!data) {
            return completionItem;
        }

        return pluginHost.resolveCompletion(data, completionItem);
    });
    connection.onDidChangeWatchedFiles((para) => {
        for (const change of para.changes) {
            const filename = urlToPath(change.uri);
            if (filename) {
                pluginHost.onWatchFileChanges(filename, change.type);
            }
        }
    });

    docManager.on(
        'documentChange',
        _.debounce(async (document: Document) => {
            const diagnostics = await pluginHost.getDiagnostics({ uri: document.getURL() });
            connection!.sendDiagnostics({
                uri: document.getURL(),
                diagnostics,
            });
        }, 500),
    );

    // The language server protocol does not have a specific "did rename/move files" event,
    // so we create our own in the extension client and handle it here
    connection.onRequest('$/getEditsForFileRename', async (fileRename: RenameFile) =>
        pluginHost.updateImports(fileRename),
    );

    // This event is triggered by Svelte-Check:
    connection.onRequest('$/getDiagnostics', async (params) => {
        return await pluginHost.getDiagnostics({ uri: params.uri });
    });

    connection.listen();
}
