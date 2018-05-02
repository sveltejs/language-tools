import * as path from 'path';

import { workspace, ExtensionContext, TextDocument, Position } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    TextDocumentPositionParams,
    RequestType,
} from 'vscode-languageclient';
import { activateTagClosing } from './html/autoClose';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any, any> = new RequestType(
        'html/tag',
    );
}

export function activate(context: ExtensionContext) {
    let serverModule = context.asAbsolutePath(
        path.join('./', 'node_modules', 'svelte-language-server', 'bin', 'server.js'),
    );

    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
    };

    const lsConfig = workspace.getConfiguration('svelte.language-server');

    const serverRuntime = lsConfig.get<string>('runtime');
    if (serverRuntime) {
        serverOptions.run.runtime = serverRuntime;
        serverOptions.debug.runtime = serverRuntime;
        console.log('setting server runtime to', serverRuntime);
    }

    let clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'svelte' }],
        synchronize: {
            configurationSection: 'svelte',
        },
    };

    let client = new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions);
    context.subscriptions.push(client.start());

    client.onReady().then(() => {
        let tagRequestor = (document: TextDocument, position: Position) => {
            let param = client.code2ProtocolConverter.asTextDocumentPositionParams(
                document,
                position,
            );
            return client.sendRequest(TagCloseRequest.type, param);
        };
        let disposable = activateTagClosing(tagRequestor, { svelte: true }, 'html.autoClosingTags');
        context.subscriptions.push(disposable);
    });
}
