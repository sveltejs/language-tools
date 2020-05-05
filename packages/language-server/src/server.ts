import {
    createConnection,
    IPCMessageReader,
    IPCMessageWriter,
    TextDocumentSyncKind,
    RequestType,
    TextDocumentPositionParams,
    TextDocumentIdentifier,
} from 'vscode-languageserver';
import { DocumentManager, ManagedDocument, Document } from './lib/documents';
import { SveltePlugin, HTMLPlugin, CSSPlugin, TypeScriptPlugin, PluginHost, AppCompletionItem } from './plugins';
import _ from 'lodash';
import { LSConfigManager } from './ls-config';
import { urlToPath } from './utils';

namespace TagCloseRequest {
    export const type: RequestType<
        TextDocumentPositionParams,
        string | null,
        any,
        any
    > = new RequestType('html/tag');
}

export function startServer() {
    const connection = process.argv.includes('--stdio')
        ? createConnection(process.stdin, process.stdout)
        : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

    const docManager = new DocumentManager(
        textDocument => new ManagedDocument(textDocument.uri, textDocument.text),
    );
    const pluginHost = new PluginHost(docManager, new LSConfigManager());

    pluginHost.register(new SveltePlugin());
    pluginHost.register(new HTMLPlugin());
    pluginHost.register(new CSSPlugin());
    pluginHost.register(new TypeScriptPlugin());

    connection.onInitialize(evt => {
        pluginHost.updateConfig(evt.initializationOptions.config);
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
                        ')',
                        '[',
                        ']',
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
                codeActionProvider: true,
            },
        };
    });

    connection.onDidChangeConfiguration(({ settings }) => {
        pluginHost.updateConfig(settings.svelte?.plugin);
    });

    connection.onDidOpenTextDocument(evt => docManager.openDocument(evt.textDocument));
    connection.onDidCloseTextDocument(evt => docManager.closeDocument(evt.textDocument));
    connection.onDidChangeTextDocument(evt =>
        docManager.updateDocument(evt.textDocument, evt.contentChanges),
    );
    connection.onHover(evt => pluginHost.doHover(evt.textDocument, evt.position));
    connection.onCompletion(evt =>
        pluginHost.getCompletions(
            evt.textDocument,
            evt.position,
            evt.context && evt.context.triggerCharacter,
        ),
    );
    connection.onDocumentFormatting(evt => pluginHost.formatDocument(evt.textDocument));
    connection.onRequest(TagCloseRequest.type, evt =>
        pluginHost.doTagComplete(evt.textDocument, evt.position),
    );
    connection.onDocumentColor(evt => pluginHost.getDocumentColors(evt.textDocument));
    connection.onColorPresentation(evt =>
        pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color),
    );
    connection.onDocumentSymbol(evt => pluginHost.getDocumentSymbols(evt.textDocument));
    connection.onDefinition(evt => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onCodeAction(evt =>
        pluginHost.getCodeActions(evt.textDocument, evt.range, evt.context),
    );
    connection.onCompletionResolve(completionItem => {
        const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

        if (!data) {
            return completionItem;
        }

        return pluginHost.resolveCompletion(data, completionItem);
    });
    connection.onDidChangeWatchedFiles(para => {
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
            connection.sendDiagnostics({
                uri: document.getURL(),
                diagnostics,
            });
        }, 500),
    );

    connection.listen();
}
