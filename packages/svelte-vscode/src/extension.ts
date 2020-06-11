import {
    workspace,
    ExtensionContext,
    TextDocument,
    Position,
    Range,
    commands,
    window,
    WorkspaceEdit,
    Uri,
    ProgressLocation,
    ViewColumn,
    TextDocumentContentProvider,
} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    TextDocumentPositionParams,
    RequestType,
    RevealOutputChannelOn,
    WorkspaceEdit as LSWorkspaceEdit,
    TextDocumentEdit,
} from 'vscode-languageclient';
import { activateTagClosing } from './html/autoClose';

function atob(encoded: string) {
    const buffer = Buffer.from(encoded, 'base64');
    return buffer.toString('utf8');
}

function btoa(decoded: string) {
    const buffer = Buffer.from(decoded, 'utf8');
    return buffer.toString('base64');
}

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any, any> = new RequestType(
        'html/tag',
    );
}

export function activate(context: ExtensionContext) {
    const serverModule = require.resolve('svelte-language-server/bin/server.js');
    const runtimeConfig = workspace.getConfiguration('svelte.language-server');

    const runExecArgv: string[] = [];
    let port = runtimeConfig.get<number>('port') ?? -1;
    if (port < 0) {
        port = 6009;
    } else {
        console.log('setting port to', port);
        runExecArgv.push(`--inspect=${port}`);
    }
    const debugOptions = { execArgv: ['--nolazy', `--inspect=${port}`] };

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: runExecArgv },
        },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
    };

    const serverRuntime = runtimeConfig.get<string>('runtime');
    if (serverRuntime) {
        serverOptions.run.runtime = serverRuntime;
        serverOptions.debug.runtime = serverRuntime;
        console.log('setting server runtime to', serverRuntime);
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'svelte' }],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        synchronize: {
            configurationSection: ['svelte'],
            fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false),
        },
        initializationOptions: { config: workspace.getConfiguration('svelte.plugin') },
    };

    let ls = createLanguageServer(serverOptions, clientOptions);
    context.subscriptions.push(ls.start());

    ls.onReady().then(() => {
        const tagRequestor = (document: TextDocument, position: Position) => {
            const param = ls.code2ProtocolConverter.asTextDocumentPositionParams(
                document,
                position,
            );
            return ls.sendRequest(TagCloseRequest.type, param);
        };
        const disposable = activateTagClosing(
            tagRequestor,
            { svelte: true },
            'html.autoClosingTags',
        );
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

    context.subscriptions.push(
        commands.registerTextEditorCommand('svelte.showCompiledCodeToSide', async (editor) => {
            if (editor?.document?.languageId !== 'svelte') return;

            const uri = editor.document.uri;
            window.withProgress(
                { location: ProgressLocation.Window, title: 'Compiling..' },
                async () => {
                    const result: {
                        js: { code: string; map: any };
                        css: { code: string; map: any };
                    } = await ls.sendRequest('$/getCompiledCode', uri.toString());

                    if (!result || !result.js.code) {
                        window.showInformationMessage('Svelte compilation failed.');
                        return;
                    }

                    const b64 = btoa(result.js.code);
                    const newUriString = `svelte://${uri.path}.js#${b64}`;
                    const doc = await workspace.openTextDocument(Uri.parse(newUriString));
                    await window.showTextDocument(doc, {
                        preview: true,
                        viewColumn: ViewColumn.Beside,
                    });
                },
            );
        }),
    );

    const compiledCodePreviewProvider = new (class CompiledCodePreviewProvider
        implements TextDocumentContentProvider {
        provideTextDocumentContent(uri: Uri): string {
            const b64 = uri.fragment;
            return atob(b64);
        }
    })();

    context.subscriptions.push(
        workspace.registerTextDocumentContentProvider('svelte', compiledCodePreviewProvider),
    );

    workspace.onDidRenameFiles(async (evt) => {
        window.withProgress(
            { location: ProgressLocation.Window, title: 'Updating Imports..' },
            async () => {
                const editsForFileRename = await ls.sendRequest<LSWorkspaceEdit | null>(
                    '$/getEditsForFileRename',
                    // Right now files is always an array with a single entry.
                    // The signature was only designed that way to - maybe, in the future -
                    // have the possibility to change that. If that ever does, update this.
                    // In the meantime, just assume it's a single entry and simplify the
                    // rest of the logic that way.
                    {
                        oldUri: evt.files[0].oldUri.toString(true),
                        newUri: evt.files[0].newUri.toString(true),
                    },
                );
                if (!editsForFileRename) {
                    return;
                }

                const workspaceEdit = new WorkspaceEdit();
                // Renaming a file should only result in edits of existing files
                editsForFileRename.documentChanges?.filter(TextDocumentEdit.is).forEach((change) =>
                    change.edits.forEach((edit) => {
                        workspaceEdit.replace(
                            Uri.parse(change.textDocument.uri),
                            new Range(
                                new Position(edit.range.start.line, edit.range.start.character),
                                new Position(edit.range.end.line, edit.range.end.character),
                            ),
                            edit.newText,
                        );
                    }),
                );
                workspace.applyEdit(workspaceEdit);
            },
        );
    });
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
    return new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions);
}
