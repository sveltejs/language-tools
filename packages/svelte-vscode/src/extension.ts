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
    languages,
    IndentAction,
    extensions
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
    ExecuteCommandRequest
} from 'vscode-languageclient';
import { activateTagClosing } from './html/autoClose';
import { EMPTY_ELEMENTS } from './html/htmlEmptyTagsShared';
import CompiledCodeContentProvider from './CompiledCodeContentProvider';
import * as path from 'path';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any, any> = new RequestType(
        'html/tag'
    );
}

export function activate(context: ExtensionContext) {
    warnIfOldExtensionInstalled();

    const runtimeConfig = workspace.getConfiguration('svelte.language-server');

    const { workspaceFolders } = workspace;
    const rootPath = Array.isArray(workspaceFolders) ? workspaceFolders[0].uri.fsPath : undefined;

    const tempLsPath = runtimeConfig.get<string>('ls-path');
    // Returns undefined if path is empty string
    // Return absolute path if not already
    const lsPath =
        tempLsPath && tempLsPath.trim() !== ''
            ? path.isAbsolute(tempLsPath)
                ? tempLsPath
                : path.join(rootPath as string, tempLsPath)
            : undefined;

    const serverModule = require.resolve(lsPath || 'svelte-language-server/bin/server.js');
    console.log('Loading server from ', serverModule);

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
            options: { execArgv: runExecArgv }
        },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
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
            fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false)
        },
        initializationOptions: {
            config: workspace.getConfiguration('svelte.plugin'),
            prettierConfig: workspace.getConfiguration('prettier'),
            emmetConfig: workspace.getConfiguration('emmet'),
            dontFilterIncompleteCompletions: true // VSCode filters client side and is smarter at it than us
        }
    };

    let ls = createLanguageServer(serverOptions, clientOptions);
    context.subscriptions.push(ls.start());

    ls.onReady().then(() => {
        const tagRequestor = (document: TextDocument, position: Position) => {
            const param = ls.code2ProtocolConverter.asTextDocumentPositionParams(
                document,
                position
            );
            return ls.sendRequest(TagCloseRequest.type, param);
        };
        const disposable = activateTagClosing(
            tagRequestor,
            { svelte: true },
            'html.autoClosingTags'
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
        })
    );

    function getLS() {
        return ls;
    }

    addRenameFileListener(getLS);

    addCompilePreviewCommand(getLS, context);

    addExtracComponentCommand(getLS, context);

    languages.setLanguageConfiguration('svelte', {
        indentationRules: {
            // Matches a valid opening tag that is:
            //  - Not a doctype
            //  - Not a void element
            //  - Not a closing tag
            //  - Not followed by a closing tag of the same element
            // Or matches `<!--`
            // Or matches open curly brace
            //
            // eslint-disable-next-line max-len, no-useless-escape
            increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
            // Matches a closing tag that:
            //  - Follows optional whitespace
            //  - Is not `</html>`
            // Or matches `-->`
            // Or closing curly brace
            //
            // eslint-disable-next-line no-useless-escape
            decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
        },
        // Matches a number or word that either:
        //  - Is a number with an optional negative sign and optional full number
        //    with numbers following the decimal point. e.g `-1.1px`, `.5`, `-.42rem`, etc
        //  - Is a sequence of characters without spaces and not containing
        //    any of the following: `~!@$^&*()=+[{]}\|;:'",.<>/
        //
        // eslint-disable-next-line max-len, no-useless-escape
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\#\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                // Matches an opening tag that:
                //  - Isn't an empty element
                //  - Is possibly namespaced
                //  - Isn't a void element
                //  - Isn't followed by another tag on the same line
                //
                // eslint-disable-next-line no-useless-escape
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join(
                        '|'
                    )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                // Matches a closing tag that:
                //  - Is possibly namespaced
                //  - Possibly has excess whitespace following tagname
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
                action: { indentAction: IndentAction.IndentOutdent }
            },
            {
                // Matches an opening tag that:
                //  - Isn't an empty element
                //  - Isn't namespaced
                //  - Isn't a void element
                //  - Isn't followed by another tag on the same line
                //
                // eslint-disable-next-line no-useless-escape
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                action: { indentAction: IndentAction.Indent }
            }
        ]
    });
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
                        newUri: evt.files[0].newUri.toString(true)
                    }
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
                                new Position(edit.range.end.line, edit.range.end.character)
                            ),
                            edit.newText
                        );
                    })
                );
                workspace.applyEdit(workspaceEdit);
            }
        );
    });
}

function addCompilePreviewCommand(getLS: () => LanguageClient, context: ExtensionContext) {
    const compiledCodeContentProvider = new CompiledCodeContentProvider(getLS);

    context.subscriptions.push(
        workspace.registerTextDocumentContentProvider(
            CompiledCodeContentProvider.scheme,
            compiledCodeContentProvider
        ),
        compiledCodeContentProvider
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
                        viewColumn: ViewColumn.Beside
                    });
                }
            );
        })
    );
}

function addExtracComponentCommand(getLS: () => LanguageClient, context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerTextEditorCommand('svelte.extractComponent', async (editor) => {
            if (editor?.document?.languageId !== 'svelte') {
                return;
            }

            // Prompt for new component name
            const options = {
                prompt: 'Component Name: ',
                placeHolder: 'NewComponent'
            };

            window.showInputBox(options).then(async (filePath) => {
                if (!filePath) {
                    return window.showErrorMessage('No component name');
                }

                const uri = editor.document.uri.toString();
                const range = editor.selection;
                getLS().sendRequest(ExecuteCommandRequest.type, {
                    command: 'extract_to_svelte_component',
                    arguments: [uri, { uri, range, filePath }]
                });
            });
        })
    );
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
    return new LanguageClient('svelte', 'Svelte', serverOptions, clientOptions);
}

function warnIfOldExtensionInstalled() {
    if (extensions.getExtension('JamesBirtles.svelte-vscode')) {
        window.showWarningMessage(
            'It seems you have the old and deprecated extension named "Svelte" installed. Please remove it. ' +
                'Through the UI: You can find it when searching for "@installed" in the extensions window (searching "Svelte" won\'t work). ' +
                'Command line: "code --uninstall-extension JamesBirtles.svelte-vscode"'
        );
    }
}
