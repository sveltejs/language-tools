import {
    createConnection,
    IPCMessageReader,
    IPCMessageWriter,
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { DocumentManager } from './lib/documents/DocumentManager';
import { SvelteDocument } from './lib/documents/SvelteDocument';
import { SveltePlugin } from './plugins/SveltePlugin';
import { HTMLPlugin } from './plugins/HTMLPlugin';
import { CSSPlugin } from './plugins/CSSPlugin';
import { wrapFragmentPlugin } from './api/wrapFragmentPlugin';
import { TypeScriptPlugin } from './plugins/TypeScriptPlugin';

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
                    triggerCharacters: ['<'],
                },
                documentFormattingProvider: true,
            },
        };
    });

    connection.onDidOpenTextDocument(evt => manager.openDocument(evt.textDocument));
    connection.onDidCloseTextDocument(evt => manager.closeDocument(evt.textDocument));
    connection.onDidChangeTextDocument(evt =>
        manager.updateDocument(evt.textDocument, evt.contentChanges),
    );
    connection.onHover(evt => manager.doHover(evt.textDocument, evt.position));
    connection.onCompletion(evt => manager.getCompletions(evt.textDocument, evt.position));
    connection.onDocumentFormatting(evt => manager.formatDocument(evt.textDocument));

    manager.on('documentChange', async document => {
        const diagnostics = await manager.getDiagnostics({ uri: document.getURL() });
        connection.sendDiagnostics({
            uri: document.getURL(),
            diagnostics,
        });
    });

    connection.listen();
}
