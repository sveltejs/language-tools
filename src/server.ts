import {
    createConnection,
    IPCMessageReader,
    IPCMessageWriter,
    TextDocumentSyncKind,
    RequestType,
    TextDocumentPositionParams,
} from 'vscode-languageserver';
import { DocumentManager } from './lib/documents/DocumentManager';
import { SvelteDocument } from './lib/documents/SvelteDocument';
import { SveltePlugin } from './plugins/SveltePlugin';
import { HTMLPlugin } from './plugins/HTMLPlugin';
import { CSSPlugin } from './plugins/CSSPlugin';
import { wrapFragmentPlugin } from './api/wrapFragmentPlugin';
import { TypeScriptPlugin } from './plugins/TypeScriptPlugin';
import _ from 'lodash';

namespace TagCloseRequest {
    export const type: RequestType<
        TextDocumentPositionParams,
        string | null,
        any,
        any
    > = new RequestType('html/tag');
}

export function startServer() {
    const connection = createConnection(
        new IPCMessageReader(process),
        new IPCMessageWriter(process),
    );

    const manager = new DocumentManager(
        textDocument => new SvelteDocument(textDocument.uri, textDocument.text),
    );

    manager.register(new SveltePlugin());
    manager.register(new HTMLPlugin());
    manager.register(wrapFragmentPlugin(new CSSPlugin(), CSSPlugin.matchFragment));
    manager.register(wrapFragmentPlugin(new TypeScriptPlugin(), TypeScriptPlugin.matchFragment));

    connection.onInitialize(evt => {
        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
                },
                hoverProvider: manager.supports('doHover'),
                completionProvider: {
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
        manager.updateConfig(settings.svelte);
    });

    connection.onDidOpenTextDocument(evt => manager.openDocument(evt.textDocument));
    connection.onDidCloseTextDocument(evt => manager.closeDocument(evt.textDocument));
    connection.onDidChangeTextDocument(evt =>
        manager.updateDocument(evt.textDocument, evt.contentChanges),
    );
    connection.onHover(evt => manager.doHover(evt.textDocument, evt.position));
    connection.onCompletion(evt =>
        manager.getCompletions(
            evt.textDocument,
            evt.position,
            evt.context && evt.context.triggerCharacter,
        ),
    );
    connection.onDocumentFormatting(evt => manager.formatDocument(evt.textDocument));
    connection.onRequest(TagCloseRequest.type, evt =>
        manager.doTagComplete(evt.textDocument, evt.position),
    );
    connection.onDocumentColor(evt => manager.getDocumentColors(evt.textDocument));
    connection.onColorPresentation(evt =>
        manager.getColorPresentations(evt.textDocument, evt.range, evt.color),
    );
    connection.onDocumentSymbol(evt => manager.getDocumentSymbols(evt.textDocument));
    connection.onDefinition(evt => manager.getDefinitions(evt.textDocument, evt.position));
    connection.onCodeAction(evt =>
        manager.getCodeActions(evt.textDocument, evt.range, evt.context),
    );

    manager.on(
        'documentChange',
        _.debounce(async document => {
            const diagnostics = await manager.getDiagnostics({ uri: document.getURL() });
            connection.sendDiagnostics({
                uri: document.getURL(),
                diagnostics,
            });
        }, 500),
    );

    connection.listen();
}
