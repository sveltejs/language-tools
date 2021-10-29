import * as path from 'path';
import {
    commands,
    ExtensionContext,
    extensions,
    IndentAction,
    languages,
    Position,
    ProgressLocation,
    Range,
    TextDocument,
    Uri,
    ViewColumn,
    window,
    workspace,
    WorkspaceEdit
} from 'vscode';
import {
    ExecuteCommandRequest,
    LanguageClientOptions,
    RequestType,
    RevealOutputChannelOn,
    TextDocumentEdit,
    TextDocumentPositionParams,
    WorkspaceEdit as LSWorkspaceEdit
} from 'vscode-languageclient';
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import CompiledCodeContentProvider from './CompiledCodeContentProvider';
import { activateTagClosing } from './html/autoClose';
import { EMPTY_ELEMENTS } from './html/htmlEmptyTagsShared';
import { TsPlugin } from './tsplugin';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any> = new RequestType(
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

    // Add --experimental-modules flag for people using node 12 < version < 12.17
    // Remove this in mid 2022 and bump vs code minimum required version to 1.55
    const runExecArgv: string[] = ['--experimental-modules'];
    let port = runtimeConfig.get<number>('port') ?? -1;
    if (port < 0) {
        port = 6009;
    } else {
        console.log('setting port to', port);
        runExecArgv.push(`--inspect=${port}`);
    }
    const debugOptions = { execArgv: ['--nolazy', '--experimental-modules', `--inspect=${port}`] };

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
            configurationSection: [
                'svelte',
                'javascript',
                'typescript',
                'prettier',
                'css',
                'less',
                'scss'
            ],
            fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false)
        },
        initializationOptions: {
            configuration: {
                svelte: workspace.getConfiguration('svelte'),
                prettier: workspace.getConfiguration('prettier'),
                emmet: workspace.getConfiguration('emmet'),
                typescript: workspace.getConfiguration('typescript'),
                javascript: workspace.getConfiguration('javascript'),
                css: workspace.getConfiguration('css'),
                less: workspace.getConfiguration('less'),
                scss: workspace.getConfiguration('scss')
            },
            dontFilterIncompleteCompletions: true, // VSCode filters client side and is smarter at it than us
            isTrusted: (workspace as any).isTrusted
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

    workspace.onDidSaveTextDocument(async (doc) => {
        const parts = doc.uri.toString(true).split(/\/|\\/);
        if (
            [
                'tsconfig.json',
                'jsconfig.json',
                'svelte.config.js',
                'svelte.config.cjs',
                'svelte.config.mjs'
            ].includes(parts[parts.length - 1])
        ) {
            await restartLS(false);
        }
    });

    context.subscriptions.push(
        commands.registerCommand('svelte.restartLanguageServer', async () => {
            await restartLS(true);
        })
    );

    let restartingLs = false;
    async function restartLS(showNotification: boolean) {
        if (restartingLs) {
            return;
        }

        restartingLs = true;
        await ls.stop();
        ls = createLanguageServer(serverOptions, clientOptions);
        context.subscriptions.push(ls.start());
        await ls.onReady();
        if (showNotification) {
            window.showInformationMessage('Svelte language server restarted.');
        }
        restartingLs = false;
    }

    function getLS() {
        return ls;
    }

    addDidChangeTextDocumentListener(getLS);

    addRenameFileListener(getLS);

    addCompilePreviewCommand(getLS, context);

    addExtracComponentCommand(getLS, context);

    TsPlugin.create(context);

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
            increaseIndentPattern:
                // eslint-disable-next-line max-len, no-useless-escape
                /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
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
        wordPattern:
            // eslint-disable-next-line max-len, no-useless-escape
            /(-?\d*\.\d\w*)|([^\`\~\!\@\$\#\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
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

    // This API is considered private and only exposed for experimenting.
    // Interface may change at any time. Use at your own risk!
    return {
        /**
         * As a function, because restarting the server
         * will result in another instance.
         */
        getLanguageServer: getLS
    };
}

function addDidChangeTextDocumentListener(getLS: () => LanguageClient) {
    // Only Svelte file changes are automatically notified through the inbuilt LSP
    // because the extension says it's only responsible for Svelte files.
    // Therefore we need to set this up for TS/JS files manually.
    workspace.onDidChangeTextDocument((evt) => {
        if (evt.document.languageId === 'typescript' || evt.document.languageId === 'javascript') {
            getLS().sendNotification('$/onDidChangeTsOrJsFile', {
                uri: evt.document.uri.toString(true),
                changes: evt.contentChanges.map((c) => ({
                    range: {
                        start: { line: c.range.start.line, character: c.range.start.character },
                        end: { line: c.range.end.line, character: c.range.end.character }
                    },
                    text: c.text
                }))
            });
        }
    });
}

function addRenameFileListener(getLS: () => LanguageClient) {
    workspace.onDidRenameFiles(async (evt) => {
        const oldUri = evt.files[0].oldUri.toString(true);
        const parts = oldUri.split(/\/|\\/);
        const lastPart = parts[parts.length - 1];
        // If user moves/renames a folder, the URI only contains the parts up to that folder,
        // and not files. So in case the URI does not contain a '.', check for imports to update.
        if (
            lastPart.includes('.') &&
            !['.ts', '.js', '.json', '.svelte'].some((ending) => lastPart.endsWith(ending))
        ) {
            return;
        }

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
                        oldUri,
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
