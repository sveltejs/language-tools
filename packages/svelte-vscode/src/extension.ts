import * as path from 'path';
import {
    commands,
    Disposable,
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
    CloseAction,
    ErrorAction,
    ExecuteCommandRequest,
    LanguageClientOptions,
    RequestType,
    RevealOutputChannelOn,
    State,
    TextDocumentEdit,
    TextDocumentPositionParams,
    WorkspaceEdit as LSWorkspaceEdit
} from 'vscode-languageclient';
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import CompiledCodeContentProvider from './CompiledCodeContentProvider';
import { activateTagClosing } from './html/autoClose';
import { EMPTY_ELEMENTS } from './html/htmlEmptyTagsShared';
import { TsPlugin } from './tsplugin';
import { addFindComponentReferencesListener } from './typescript/findComponentReferences';
import { addFindFileReferencesListener } from './typescript/findFileReferences';
import { setupSvelteKit } from './sveltekit';
import { resolveCodeLensMiddleware } from './typescript/codeLensMiddleware';
import {
    getMergedConfiguration as getMergedTsConfigurations,
    sendNotificationMiddleware
} from './typescript/configurationMiddleware';
import { versions } from 'node:process';
import {
    CheckContentMapperConfigRequest,
    TsContentMapperService
} from './typescript-go/contentMapper';

const [node_major, node_minor] = (versions?.node ?? '0.0.0-unknown').split('.', 3).map(Number);

const add_experimental_strip_types_flag =
    (node_major === 22 && node_minor > 5 && node_minor < 18) || // flag added in 22.6.0, removed in 22.18.0
    (node_major === 23 && node_minor < 6); // flag removed in 23.6.0

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any> = new RequestType(
        'html/tag'
    );
}

let lsApi:
    | {
          getLS(): LanguageClient;
          restartLS(showNotification: boolean): Promise<void>;
      }
    | undefined;

export async function activate(context: ExtensionContext) {
    const contentMapperService = new TsContentMapperService(
        context.extension,
        context.workspaceState
    );
    context.subscriptions.push(contentMapperService);
    contentMapperService.setSvelteLanguageServerAccess({
        getContentMapperModeClient() {
            const ls = lsApi?.getLS();
            return ls?.isRunning() && isContentMapperMode(ls) ? ls : undefined;
        }
    });
    const options: SvelteLanguageServerOptions = {
        tsGoContentMapperOptions: await contentMapperService.tryStart(),
        deferDocumentHighlightsToTsgo: () => contentMapperService.lspMiddlewareActive,
        renewTsGoContentMapperOptions: () => contentMapperService.renewApiConnection(),
        onDidStart: (ls, requestedContentMapperMode) =>
            contentMapperService.onSvelteLanguageServerStarted(
                requestedContentMapperMode,
                ls.initializeResult?.customServerStatus?.experimental?.contentMapperConfig
            )
    };

    let tsPlugin: TsPlugin | undefined;
    function updateTsPlugin() {
        if (options.tsGoContentMapperOptions.enable) {
            tsPlugin?.dispose();
            tsPlugin = undefined;
            return;
        }
        // The extension is activated on TS/JS/Svelte files because else it might be too late to configure the TS plugin:
        // If we only activate on Svelte file and the user opens a TS file first, the configuration command is issued too late.
        // We wait until there's a Svelte file open and only then start the actual language client.
        tsPlugin ??= new TsPlugin(context);
    }
    updateTsPlugin();
    // both modes serve file references (TS6, or TS7 through its API)
    commands.executeCommand('setContext', 'svelte.uiContext.fileReference.enable', true);

    context.subscriptions.push(
        commands.registerCommand('svelte.restartLanguageServer', async () => {
            await lsApi?.restartLS(true);
        })
    );

    if (workspace.textDocuments.some((doc) => doc.languageId === 'svelte')) {
        lsApi = activateSvelteLanguageServer(context, options);
        tsPlugin?.askToEnable();
    } else {
        const onTextDocumentListener = workspace.onDidOpenTextDocument((doc) => {
            if (doc.languageId === 'svelte') {
                lsApi = activateSvelteLanguageServer(context, options);
                tsPlugin?.askToEnable();
                onTextDocumentListener.dispose();
            }
        });

        context.subscriptions.push(onTextDocumentListener);
    }

    setupSvelteKit(context);

    context.subscriptions.push(
        contentMapperService.onDidChangeEnablement(async (newConfig) => {
            if (newConfig !== options.tsGoContentMapperOptions.enable) {
                const newOption = await contentMapperService.tryStart();
                // When turned on at runtime, the TS7 server usually isn't (re)started yet, and
                // the option stays off until it is (onTsServerRestart). Don't restart for nothing.
                if (newOption.enable !== options.tsGoContentMapperOptions.enable) {
                    options.tsGoContentMapperOptions = newOption;
                    updateTsPlugin();
                    await lsApi?.restartLS(false);
                }
            }
        })
    );

    context.subscriptions.push(
        contentMapperService.onTsServerRestart(async () => {
            const newOption = await contentMapperService.tryStart();
            // a new TS7 server needs a new API connection (apiPipe) too
            if (newOption.enable !== options.tsGoContentMapperOptions.enable || newOption.apiPipe) {
                options.tsGoContentMapperOptions = newOption;
                updateTsPlugin();
                await lsApi?.restartLS(false);
            }
        })
    );

    // This API is considered private and only exposed for experimenting.
    // Interface may change at any time. Use at your own risk!
    return {
        /**
         * As a function, because restarting the server
         * will result in another instance.
         */
        getLanguageServer() {
            if (!lsApi) {
                lsApi = activateSvelteLanguageServer(context, options);
            }

            return lsApi.getLS();
        }
    };
}

export function deactivate() {
    const stop = lsApi?.getLS().stop();
    lsApi = undefined;
    return stop;
}

/** Allows fewer than `max` crashes per `windowMs` (vscode-languageclient's default: 5 in 3 minutes) */
class CrashLimiter {
    private readonly crashes: number[] = [];

    constructor(
        private readonly max: number,
        private readonly windowMs: number
    ) {}

    /** Call on each crash; false once the limit is reached */
    allowRestart(now: number): boolean {
        this.crashes.push(now);
        while (this.crashes.length && this.crashes[0] <= now - this.windowMs) {
            this.crashes.shift();
        }
        return this.crashes.length < this.max;
    }
}

function isContentMapperMode(ls: LanguageClient) {
    return !!ls.initializeResult?.customServerStatus?.experimental?.contentMapperModeEnabled;
}

interface SvelteLanguageServerOptions {
    tsGoContentMapperOptions: { enable: boolean };
    /**
     * When TS7 serves the Svelte file and our middleware is registered on it, the highlights
     * of both servers are merged in the middleware. VS Code only uses the first provider with
     * a non-empty result, so ours must not compete.
     */
    deferDocumentHighlightsToTsgo?: () => boolean;
    /** Fresh options for a restart (a new TS7 API pipe) */
    renewTsGoContentMapperOptions?: () => Promise<{ enable: boolean }>;
    /** After each (re)start of the language server */
    onDidStart?: (ls: LanguageClient, requestedContentMapperMode: boolean) => void;
}

export function activateSvelteLanguageServer(
    context: ExtensionContext,
    options?: SvelteLanguageServerOptions
) {
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

    const serverRuntime = runtimeConfig.get<string>('runtime');

    const runExecArgv: string[] = [];
    if (!serverRuntime && add_experimental_strip_types_flag) {
        runExecArgv.push('--experimental-strip-types');
    }

    const runtimeArgs = runtimeConfig.get<string[]>('runtime-args');
    if (runtimeArgs !== undefined) {
        runExecArgv.push(...runtimeArgs);
    }

    const debugArgs = ['--nolazy'];

    const port = runtimeConfig.get<number>('port') ?? -1;
    if (port < 0) {
        debugArgs.push('--inspect=6009');
    } else {
        console.log('setting port to', port);
        runExecArgv.push(`--inspect=${port}`);
    }

    debugArgs.push(...runExecArgv);

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: runExecArgv }
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: debugArgs }
        }
    };

    if (serverRuntime) {
        serverOptions.run.runtime = serverRuntime;
        serverOptions.debug.runtime = serverRuntime;
        console.log('setting server runtime to', serverRuntime);
    }

    // Manually create the output channel so that it'll be reused and won't lose focus during restarts
    const outputChannel = window.createOutputChannel('Svelte', 'svelte');
    const clientOptions: LanguageClientOptions = {
        outputChannel,
        documentSelector: [{ scheme: 'file', language: 'svelte' }],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        synchronize: {
            // TODO deprecated, rework upon next VS Code minimum version bump
            configurationSection: [
                'svelte',
                'prettier',
                'emmet',
                'javascript',
                'typescript',
                'js/ts',
                'css',
                'less',
                'scss',
                'html'
            ]
        },
        // A function so that we can change options (e.g. tsGoContentMapperOptions) after the
        // extension activated and restart the LSP with the updated options
        initializationOptions: () => ({
            configuration: {
                svelte: workspace.getConfiguration('svelte'),
                prettier: workspace.getConfiguration('prettier'),
                emmet: workspace.getConfiguration('emmet'),
                ...getMergedTsConfigurations(),
                css: workspace.getConfiguration('css'),
                less: workspace.getConfiguration('less'),
                scss: workspace.getConfiguration('scss'),
                html: workspace.getConfiguration('html')
            },
            dontFilterIncompleteCompletions: true, // VSCode filters client side and is smarter at it than us
            isTrusted: workspace.isTrusted,
            tsGoContentMapperOptions: options?.tsGoContentMapperOptions
        }),
        errorHandler: {
            error: () => ({ action: ErrorAction.Continue }),
            closed: () => {
                if (!crashLimiter.allowRestart(Date.now())) {
                    return {
                        action: CloseAction.DoNotRestart,
                        message:
                            'The Svelte language server crashed 5 times in the last 3 minutes. It will not be restarted.'
                    };
                }
                if (
                    !options?.renewTsGoContentMapperOptions ||
                    !options.tsGoContentMapperOptions.enable
                ) {
                    return { action: CloseAction.Restart };
                }
                // The client would restart it with the old TS7 API pipe, which can't be
                // connected to again: restartLS gets a new one
                setTimeout(() => restartLS(false), 0);
                return { action: CloseAction.DoNotRestart, handled: true };
            }
        },
        middleware: {
            resolveCodeLens: resolveCodeLensMiddleware,
            sendNotification: sendNotificationMiddleware,
            provideDocumentHighlights: (document, position, token, next) => {
                if (options?.deferDocumentHighlightsToTsgo?.() && isContentMapperMode(ls)) {
                    return null;
                }
                return next(document, position, token);
            }
        }
    };

    const crashLimiter = new CrashLimiter(5, 3 * 60 * 1000);
    const ls = createLanguageServer(serverOptions, clientOptions);
    let ts6Features: Disposable | undefined;
    let tsgoFeatures: Disposable | undefined;
    // what the running server was started with (the options can change before a restart)
    let requestedContentMapperMode = !!options?.tsGoContentMapperOptions.enable;
    context.subscriptions.push(
        { dispose: () => ts6Features?.dispose() },
        { dispose: () => tsgoFeatures?.dispose() },
        ls.onDidChangeState(({ newState }) => {
            if (newState === State.Starting) {
                requestedContentMapperMode = !!options?.tsGoContentMapperOptions.enable;
            } else if (newState === State.Running) {
                updateCustomTs6Features();
                options?.onDidStart?.(ls, requestedContentMapperMode);
            }
        }),
        watchContentMapperConfig()
    );
    ls.start().then(() => {
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
                // tsconfig/jsconfig: see watchContentMapperConfig
                /^svelte\.config\.(js|ts|cjs|mjs|mts)$/,
                // Vite config can contain Svelte config
                /^vite\.config\.(js|cjs|mjs|ts|mts)$/,
                // https://prettier.io/docs/en/configuration.html
                /^\.prettierrc$/,
                /^\.prettierrc\.(json|yml|yaml|json5|toml)$/,
                /^\.prettierrc\.(js|cjs)$/,
                /^prettier\.config\.(js|cjs)$/
            ].some((regex) => regex.test(parts[parts.length - 1]))
        ) {
            await restartLS(false);
        }
    });

    let restartingLs = false;
    async function restartLS(showNotification: boolean) {
        if (restartingLs) {
            return;
        }

        restartingLs = true;
        try {
            if (options?.renewTsGoContentMapperOptions) {
                // the API pipe of the previous start can't be connected to again
                options.tsGoContentMapperOptions = await options.renewTsGoContentMapperOptions();
            }
            outputChannel.clear();
            if (ls.state === State.Stopped) {
                // after a crash (see the error handler)
                await ls.start();
            } else {
                await ls.restart();
            }
        } finally {
            restartingLs = false;
        }
        if (showNotification) {
            window.showInformationMessage('Svelte language server restarted.');
        }
    }

    /**
     * Content mapper mode is decided when the server starts (see the README, "TypeScript 7"): by
     * whether a `tsconfig*.json`/`jsconfig*.json` mentions the mapper. When one changes and TS7
     * could serve Svelte files, ask the server again and restart only if the mode would change.
     * In TS6 mode the server watches the configs itself. Workspace folder changes restart
     * directly. A change while the server is not running (e.g. restarting) is not checked.
     */
    function watchContentMapperConfig(): Disposable {
        const wanted = () => !!options?.tsGoContentMapperOptions.enable;
        const recheck = async () => {
            if (!wanted() || restartingLs || !ls.isRunning()) {
                return;
            }
            try {
                const { configFile } = await ls.sendRequest<{ configFile?: string }>(
                    CheckContentMapperConfigRequest
                );
                if (!!configFile !== isContentMapperMode(ls)) {
                    await restartLS(false);
                }
            } catch (error) {
                console.log(`Checking the content mapper config failed: ${error}`);
            }
        };
        const watcher = workspace.createFileSystemWatcher('**/{tsconfig,jsconfig}*.json');
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onChange = (uri: Uri) => {
            if (!wanted() || uri.path.includes('/node_modules/')) {
                return;
            }
            clearTimeout(timer);
            timer = setTimeout(recheck, 500);
        };
        return Disposable.from(
            watcher,
            watcher.onDidChange(onChange),
            watcher.onDidCreate(onChange),
            watcher.onDidDelete(onChange),
            workspace.onDidChangeWorkspaceFolders(() => {
                if (wanted()) {
                    restartLS(false);
                }
            }),
            { dispose: () => clearTimeout(timer) }
        );
    }

    function getLS() {
        return ls;
    }

    function updateCustomTs6Features() {
        const enable = !isContentMapperMode(ls);
        // With tsgo we want to disable various listeners that are only needed for our TS lsp functionality
        if (enable && !ts6Features) {
            ts6Features = Disposable.from(
                addRenameFileListener(getLS),
                addDidChangeTextDocumentListener(getLS)
            );
        } else if (!enable) {
            ts6Features?.dispose();
            ts6Features = undefined;
        }
        if (!enable && !tsgoFeatures) {
            tsgoFeatures = addWillRenameFilesListenerForTsgo(getLS);
        } else if (enable) {
            tsgoFeatures?.dispose();
            tsgoFeatures = undefined;
        }
    }

    addFindComponentReferencesListener(getLS);
    context.subscriptions.push(addFindFileReferencesListener(getLS));

    addCompilePreviewCommands(getLS, context);

    addExtracComponentCommand(getLS, context);

    addMigrateToSvelte5Command(getLS, context);

    addOpenLinkCommand(context);

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
                /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
            // Matches a closing tag that:
            //  - Follows optional whitespace
            //  - Is not `</html>`
            // Or matches `-->`
            // Or closing curly brace
            decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
        },
        // Matches a number or word that either:
        //  - Is a number with an optional negative sign and optional full number
        //    with numbers following the decimal point. e.g `-1.1px`, `.5`, `-.42rem`, etc
        //  - Is a sequence of characters without spaces and not containing
        //    any of the following: `~!@$^&*()=+[{]}\|;:'",.<>/
        //
        wordPattern:
            /(-?\d*\.\d\w*)|([^\`\~\!\@\#\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                // Matches an opening tag that:
                //  - Isn't an empty element
                //  - Is possibly namespaced
                //  - Isn't a void element
                //  - Isn't followed by another tag on the same line
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
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                action: { indentAction: IndentAction.Indent }
            }
        ]
    });

    return {
        getLS,
        restartLS
    };
}

function addDidChangeTextDocumentListener(getLS: () => LanguageClient) {
    // Only Svelte file changes are automatically notified through the inbuilt LSP
    // because the extension says it's only responsible for Svelte files.
    // Therefore we need to set this up for TS/JS files manually.
    return workspace.onDidChangeTextDocument((evt) => {
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

/**
 * Content mapper mode: TS7 updates the imports in TS/JS files when files are renamed, but not the
 * ones in Svelte files (neither imports of the renamed file nor a moved Svelte file's own relative
 * imports). The language server computes those before the rename, while the old paths still resolve
 * (TS7's view through its API), as edits for the old uris.
 */
function addWillRenameFilesListenerForTsgo(getLS: () => LanguageClient) {
    return workspace.onWillRenameFiles((evt) => {
        const files = evt.files
            .filter((file) => file.oldUri.scheme === 'file' && file.newUri.scheme === 'file')
            .map((file) => ({
                oldUri: file.oldUri.toString(true),
                newUri: file.newUri.toString(true)
            }));
        if (!files.length) {
            return;
        }
        evt.waitUntil(
            getLS()
                .sendRequest<LSWorkspaceEdit | null>('$/getEditsForFileRename', files)
                .then(
                    (edit) =>
                        edit ? getLS().protocol2CodeConverter.asWorkspaceEdit(edit) : undefined,
                    (error) => {
                        console.log('Updating imports in Svelte files failed', error);
                        return undefined;
                    }
                )
        );
    });
}

function addRenameFileListener(getLS: () => LanguageClient) {
    return workspace.onDidRenameFiles(async (evt) => {
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
                const edits = editsForFileRename?.documentChanges?.filter(TextDocumentEdit.is);
                if (!edits) {
                    return;
                }

                const workspaceEdit = new WorkspaceEdit();
                // We need to take into account multiple cases:
                // - A Svelte file is moved/renamed
                //      -> all updates will be related to that Svelte file, do that here. The TS LS won't even notice the update
                // - A TS/JS file is moved/renamed
                //      -> all updates will be related to that TS/JS file
                //      -> let the TS LS take care of these updates in TS/JS files, do Svelte file updates here
                // - A folder with TS/JS AND Svelte files is moved/renamed
                //      -> all Svelte file updates are handled here
                //      -> all TS/JS file updates that consist of only TS/JS import updates are handled by the TS LS
                //      -> all TS/JS file updates that consist of only Svelte import updates are handled here
                //      -> all TS/JS file updates that are mixed are handled here, but also possibly by the TS LS
                //         if the TS plugin doesn't prevent it. This trades risk of broken updates with certainty of missed updates
                edits.forEach((change) => {
                    const isTsOrJsFile =
                        change.textDocument.uri.endsWith('.ts') ||
                        change.textDocument.uri.endsWith('.js');
                    const containsSvelteImportUpdate = change.edits.some((edit) =>
                        edit.newText.endsWith('.svelte')
                    );
                    if (isTsOrJsFile && !containsSvelteImportUpdate) {
                        return;
                    }

                    change.edits.forEach((edit) => {
                        if (
                            isTsOrJsFile &&
                            !TsPlugin.isEnabled() &&
                            !edit.newText.endsWith('.svelte')
                        ) {
                            // TS plugin enabled -> all mixed imports are handled here
                            // TS plugin disabled -> let TS/JS path updates be handled by the TS LS, Svelte here
                            return;
                        }

                        // Renaming a file should only result in edits of existing files
                        workspaceEdit.replace(
                            Uri.parse(change.textDocument.uri),
                            new Range(
                                new Position(edit.range.start.line, edit.range.start.character),
                                new Position(edit.range.end.line, edit.range.end.character)
                            ),
                            edit.newText
                        );
                    });
                });
                workspace.applyEdit(workspaceEdit);
            }
        );
    });
}

function addCompilePreviewCommands(getLS: () => LanguageClient, context: ExtensionContext) {
    const compiledCodeContentProvider = new CompiledCodeContentProvider(getLS);

    context.subscriptions.push(
        // Register the content provider for "svelte-compiled://" files
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

            window.withProgress(
                { location: ProgressLocation.Window, title: 'Compiling...' },
                async () => {
                    // Open a new preview window for the compiled code
                    return await window.showTextDocument(
                        CompiledCodeContentProvider.jsPreviewWindowUri,
                        {
                            preview: true,
                            viewColumn: ViewColumn.Beside
                        }
                    );
                }
            );
        }),
        commands.registerTextEditorCommand('svelte.showCompiledCSSToSide', async (editor) => {
            if (editor?.document?.languageId !== 'svelte') {
                return;
            }

            window.withProgress(
                { location: ProgressLocation.Window, title: 'Compiling...' },
                async () => {
                    // Open a new preview window for the compiled code
                    return await window.showTextDocument(
                        CompiledCodeContentProvider.cssPreviewWindowUri,
                        {
                            preview: true,
                            viewColumn: ViewColumn.Beside
                        }
                    );
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

function addMigrateToSvelte5Command(getLS: () => LanguageClient, context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerTextEditorCommand('svelte.migrate_to_svelte_5', async (editor) => {
            if (editor?.document?.languageId !== 'svelte') {
                return;
            }

            const uri = editor.document.uri.toString();
            getLS().sendRequest(ExecuteCommandRequest.type, {
                command: 'migrate_to_svelte_5',
                arguments: [uri]
            });
        })
    );
}

function addOpenLinkCommand(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('svelte.openLink', (url: string) => {
            commands.executeCommand('vscode.open', Uri.parse(url));
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
