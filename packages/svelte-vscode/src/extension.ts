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
import CompiledCodeContentProvider from './CompiledCodeContentProvider';

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

    function getLS() {
        return ls;
    }

    addRenameFileListener(getLS);

    addCompilePreviewCommand(getLS, context);
}

function addRenameFileListener(getLS: () => LanguageClient) {
    workspace.onDidRenameFiles(async (evt) => {
        window.withProgress(
            { location: ProgressLocation.Window, title: 'Updating Imports..' },
            async () => {
                const editsForFileRename = await getLS().sendRequest<LSWorkspaceEdit | null>(
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

function addCompilePreviewCommand(getLS: () => LanguageClient, context: ExtensionContext) {
    const compiledCodeContentProvider = new CompiledCodeContentProvider(getLS);

    context.subscriptions.push(
        workspace.registerTextDocumentContentProvider(
            CompiledCodeContentProvider.scheme,
            compiledCodeContentProvider,
        ),
        compiledCodeContentProvider,
    );

    context.subscriptions.push(
        commands.registerTextEditorCommand('svelte.showCompiledCodeToSide', async (editor) => {
            if (editor?.document?.languageId !== 'svelte') {
                return;
            }

            const uri = editor.document.uri;
            const svelteUri = CompiledCodeContentProvider.toSvelteSchemeUri(uri);
            window.withProgress(
                { location: ProgressLocation.Window, title: 'Compiling..' },
                async () => {
                    return await window.showTextDocument(svelteUri, {
                        preview: true,
                        viewColumn: ViewColumn.Beside,
                    });
                },
            );
        }),
    );
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
    return new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions);
}
