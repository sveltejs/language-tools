import { workspace, ExtensionContext, TextDocument, Position, commands, window } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    TextDocumentPositionParams,
    RequestType,
    RevealOutputChannelOn,
} from 'vscode-languageclient';
import { activateTagClosing } from './html/autoClose';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any, any> = new RequestType(
        'html/tag',
    );
}

export function activate(context: ExtensionContext) {
    let serverModule = require.resolve('svelte-language-server/bin/server.js');

    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
    };

    const runtimeConfig = workspace.getConfiguration('svelte.language-server');

    const serverRuntime = runtimeConfig.get<string>('runtime');
    if (serverRuntime) {
        serverOptions.run.runtime = serverRuntime;
        serverOptions.debug.runtime = serverRuntime;
        console.log('setting server runtime to', serverRuntime);
    }

    let clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'svelte' }],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        synchronize: {
            configurationSection: ['svelte'],
        },
        initializationOptions: { config: workspace.getConfiguration('svelte.plugin') },
    };

    let ls = createLanguageServer(serverOptions, clientOptions);
    context.subscriptions.push(ls.start());

    ls.onReady().then(() => {
        let tagRequestor = (document: TextDocument, position: Position) => {
            let param = ls.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
            return ls.sendRequest(TagCloseRequest.type, param);
        };
        let disposable = activateTagClosing(tagRequestor, { svelte: true }, 'html.autoClosingTags');
        context.subscriptions.push(disposable);
    });

    context.subscriptions.push(
        commands.registerCommand('svelte.restartLanguageServer', async () => {
            await ls.stop();
            ls = createLanguageServer(serverOptions, clientOptions);
            context.subscriptions.push(ls.start());
            await ls.onReady();
            window.showInformationMessage('Svelte language server restarted.');
        }),
    );
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
    return new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions);
}
