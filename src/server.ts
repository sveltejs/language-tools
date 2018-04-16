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

const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

const manager = new DocumentManager(
    textDocument => new SvelteDocument(textDocument.uri, textDocument.text),
);

manager.register(new SveltePlugin());
manager.register(new HTMLPlugin());
manager.register(new CSSPlugin());

connection.onInitialize(evt => {
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Incremental,
            },
            hoverProvider: manager.supports('doHover'),
        },
    };
});

connection.onDidOpenTextDocument(evt => manager.openDocument(evt.textDocument));
connection.onDidCloseTextDocument(evt => manager.closeDocument(evt.textDocument));
connection.onDidChangeTextDocument(evt =>
    manager.updateDocument(evt.textDocument, evt.contentChanges),
);
connection.onHover(evt => manager.doHover(evt.textDocument, evt.position));

manager.on('documentChange', async document => {
    const diagnostics = await manager.getDiagnostics({ uri: document.getURL() });
    connection.sendDiagnostics({
        uri: document.getURL(),
        diagnostics,
    });
});

connection.listen();
