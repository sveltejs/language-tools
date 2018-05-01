import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
    let serverModule = context.asAbsolutePath(
        path.join('..', 'svelte-language-server', 'dist', 'src', 'server.js'),
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

    let disposable = new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions).start();
    context.subscriptions.push(disposable);
}
