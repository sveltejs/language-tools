import * as vscode from 'vscode';
import type {
    ExtensionAPI as TsExtensionAPI,
    TypeScriptSDK
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import {
    registerSvelteLspMiddleware,
    SvelteLanguageServerAccess,
    supportsLspMiddleware
} from './middleware';
import {
    ContentMapperConfigStatus,
    getContentMapperConfigHint,
    getContentMapperConfigSnippet,
    getUnsupportedTsExtensionMessage,
    getUnsupportedTsServerMessage,
    supportsContentMappers
} from './contentMapperConfig';

/** Has to match the request in the language server (`server.ts`) */
export const CheckContentMapperConfigRequest = '$/svelte/checkContentMapperConfig';

const MISSING_CONFIG_DONT_SHOW_AGAIN = 'svelte.tsgo.hint.missing-config.dontShowAgain';

export interface ContentMapperStartResult {
    readonly enable: boolean;
    /** Off because opening the API connection failed: the next start tries again */
    readonly retryable?: boolean;
    readonly apiPipe?: string;
    readonly typescriptPackageJsonPath?: string;
}

export class TsContentMapperService {
    private readonly svelteExtension: vscode.Extension<any>;
    private configEnabled = tsgoAndContentMapperEnabled();
    private readonly disposables: vscode.Disposable[] = [];
    private readonly enablementEmitter = new vscode.EventEmitter<boolean>();
    private readonly tsServerRestartEmitter = new vscode.EventEmitter<void>();
    private api: TsExtensionAPI | undefined;
    private contentMapperDisposables: vscode.Disposable[] | undefined;
    private svelteServerTsgoOption: Promise<ContentMapperStartResult> | undefined;
    private svelteLanguageServerAccess: SvelteLanguageServerAccess | undefined;
    private lspMiddlewareRegistered = false;
    private replayingTsServerInitialization = false;
    /** The SDK of the last TS7 server (re)start */
    private currentSdk: TypeScriptSDK | undefined;
    private readonly shownHints = new Set<string>();
    private readonly log: (message: string) => void = (message) => console.log(message);

    readonly onDidChangeEnablement = this.enablementEmitter.event;
    readonly onTsServerRestart = this.tsServerRestartEmitter.event;

    constructor(
        svelteExtension: vscode.Extension<any>,
        /** For "don't show again" of the config hints */
        private readonly memento?: vscode.Memento
    ) {
        this.svelteExtension = svelteExtension;
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                this.onDidChangeConfiguration(event);
            }),
            this.enablementEmitter
        );
    }

    /**
     * Called by the extension so the TS7 middleware can reach the Svelte language server
     */
    setSvelteLanguageServerAccess(access: SvelteLanguageServerAccess) {
        this.svelteLanguageServerAccess = access;
    }

    /**
     * Whether TS7 responses for Svelte files are post-processed by our middleware.
     * Some Svelte LS providers (e.g. document highlight) defer to TS7 in that case and are merged there.
     */
    get lspMiddlewareActive(): boolean {
        return this.lspMiddlewareRegistered;
    }

    async tryStart(): Promise<ContentMapperStartResult> {
        if (!this.configEnabled) {
            return { enable: false };
        }

        const tsGoExtension = vscode.extensions.getExtension('TypeScriptTeam.native-preview');
        if (!tsGoExtension) {
            return { enable: false };
        }

        try {
            this.api ??= (await tsGoExtension.activate()) as TsExtensionAPI;
        } catch (error) {
            // e.g. its server failed to start. Don't take the Svelte extension down with it
            this.log(`[tsgo] Activating the TypeScript 7 extension failed: ${error}`);
            return { enable: false };
        }

        if (!this.configEnabled) {
            return { enable: false };
        }

        if (
            typeof this.api?.registerContentMappers !== 'function' ||
            typeof this.api.onLanguageServerInitialized !== 'function'
        ) {
            this.warnOnce(
                'unsupported-ts-extension',
                getUnsupportedTsExtensionMessage(tsGoExtension.packageJSON?.version)
            );
            return { enable: false };
        }

        if (!this.contentMapperDisposables) {
            const disposables: vscode.Disposable[] = [];
            const contentMapperRegistration = this.api.registerContentMappers(
                this.svelteExtension.id,
                [
                    {
                        extensions: ['.svelte']
                        // TODO: Enable this once content mapper mode is the default.
                        // The reason is that once inferredProjectContribution is enabled, typescript lsp will always enable the content mapper mode.
                        // Which means the content mapper won't be an opt-in experimental feature anymore.

                        // inferredProjectContribution: {
                        //     manifest: {
                        //         name: '@sveltejs/ts-content-mapper',
                        //         exec: [
                        //             process.execPath,
                        //             './node_modules/@sveltejs/ts-content-mapper/dist/server.js'
                        //         ],
                        //         cwd: svelteExtension.extensionUri
                        //     }
                        // }
                    }
                ]
            );
            disposables.push(contentMapperRegistration);

            // Older TS7 extensions don't have registerLspMiddleware
            if (supportsLspMiddleware(this.api)) {
                disposables.push(
                    registerSvelteLspMiddleware(
                        this.api,
                        {
                            getContentMapperModeClient: () =>
                                this.svelteLanguageServerAccess?.getContentMapperModeClient()
                        },
                        this.log
                    ),
                    { dispose: () => (this.lspMiddlewareRegistered = false) }
                );
                this.lspMiddlewareRegistered = true;
            }

            // Invoked synchronously if the TS7 server is already initialized (the usual case at
            // startup: TS7's activate() waits for its server), later otherwise
            this.replayingTsServerInitialization = true;
            try {
                disposables.push(
                    this.api.onLanguageServerInitialized(this.onTsServerInitialized.bind(this))
                );
            } finally {
                this.replayingTsServerInitialization = false;
            }

            this.contentMapperDisposables = disposables;
        }

        const result = await this.svelteServerTsgoOption;
        if (result?.retryable && this.currentSdk) {
            // the last attempt to open the API connection failed: try again
            this.svelteServerTsgoOption = this.updateSvelteServerTsgGoOption(this.currentSdk);
            return await this.svelteServerTsgoOption;
        }
        return result ?? { enable: false };
    }

    /**
     * Called when the Svelte language server is running. If it was asked for content mapper mode
     * but stayed in TS6 mode, tells the user that the `contentMappers` config is missing.
     */
    onSvelteLanguageServerStarted(
        requestedContentMapperMode: boolean,
        configStatus: ContentMapperConfigStatus | undefined
    ) {
        if (!requestedContentMapperMode) {
            return;
        }
        const hint = getContentMapperConfigHint(configStatus);
        if (hint) {
            this.showConfigHint(hint);
        }
    }

    private async showConfigHint(message: string) {
        if (
            this.shownHints.has('missing-config') ||
            this.memento?.get(MISSING_CONFIG_DONT_SHOW_AGAIN)
        ) {
            return;
        }
        this.shownHints.add('missing-config');
        this.log(`[tsgo] ${message}`);

        const copySnippet = 'Copy tsconfig Snippet';
        const dontShowAgain = "Don't Show Again";
        const choice = await vscode.window.showInformationMessage(
            `Svelte: ${message}`,
            copySnippet,
            dontShowAgain
        );
        if (choice === copySnippet) {
            await vscode.env.clipboard.writeText(getContentMapperConfigSnippet());
        } else if (choice === dontShowAgain) {
            await this.memento?.update(MISSING_CONFIG_DONT_SHOW_AGAIN, true);
        }
    }

    /** Once per extension host session and message id */
    private warnOnce(id: string, message: string) {
        this.log(`[tsgo] ${message}`);
        if (this.shownHints.has(id)) {
            return;
        }
        this.shownHints.add(id);
        vscode.window.showWarningMessage(`Svelte: ${message}`);
    }

    private disposeContentMapper() {
        this.contentMapperDisposables?.forEach((disposable) => disposable.dispose());
        this.contentMapperDisposables = undefined;
    }

    dispose(): void {
        this.disposeContentMapper();
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    private onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent): void {
        if (
            event.affectsConfiguration('typescript.experimental.useTsgo') ||
            event.affectsConfiguration('js/ts.experimental.useTsgo') ||
            event.affectsConfiguration('js/ts.contentMappers.enabled')
        ) {
            const newEnable = tsgoAndContentMapperEnabled();
            if (newEnable !== this.configEnabled) {
                this.configEnabled = newEnable;
                if (!this.configEnabled) {
                    this.disposeContentMapper();
                    this.svelteServerTsgoOption = undefined;
                }
                this.enablementEmitter.fire(this.configEnabled);
            }
        }
    }

    /**
     * For a restart of the Svelte language server: a new API pipe. A pipe serves one connection,
     * so a restarted server can't reuse the one of its predecessor (it would end up without the
     * TS7 API, and so in TS6 mode). Same result as `tryStart` otherwise.
     */
    async renewApiConnection(): Promise<ContentMapperStartResult> {
        const current = await this.svelteServerTsgoOption;
        if (!(current?.enable || current?.retryable) || !this.currentSdk || !this.configEnabled) {
            return this.tryStart();
        }
        const renewed = this.updateSvelteServerTsgGoOption(this.currentSdk);
        const result = await renewed;
        // a failed renewal is not remembered: the next (re)start asks for a pipe again
        if (result.enable) {
            this.svelteServerTsgoOption = renewed;
        }
        return result;
    }

    /** @param tsdk undefined with older TS7 extensions, before the SDK was exposed */
    private onTsServerInitialized(tsdk: TypeScriptSDK | undefined): void {
        if (!this.configEnabled || !this.api) {
            return;
        }
        this.currentSdk = tsdk;

        this.svelteServerTsgoOption = this.updateSvelteServerTsgGoOption(tsdk);
        // During registration, tryStart() awaits the option itself. Every other call is a TS7
        // server (re)start the Svelte LS has to follow, including the *first* initialization if
        // the server wasn't running when we registered: e.g. when `useTsgo` is turned on at
        // runtime, TS7 starts its server after a debounce, and tryStart() already answered
        // `enable: false`.
        if (!this.replayingTsServerInitialization) {
            this.tsServerRestartEmitter.fire();
        }
    }

    private async updateSvelteServerTsgGoOption(
        tsdk: TypeScriptSDK | undefined
    ): Promise<ContentMapperStartResult> {
        if (tsdk?.version && supportsContentMappers(tsdk.version) === false) {
            this.warnOnce(
                `unsupported-ts-server:${tsdk.version}`,
                getUnsupportedTsServerMessage(tsdk.version)
            );
            return { enable: false };
        }

        const init =
            tsdk?.initializeAPIConnection ??
            // TODO: remove once the TypeScript 7 extension is updated
            (this.api as any)?.initializeAPIConnection;

        if (!init) {
            return { enable: false };
        }

        try {
            const pipe = await init();
            return {
                enable: true,
                apiPipe: pipe,
                typescriptPackageJsonPath: tsdk?.packageJsonPath
            };
        } catch (error) {
            // e.g. the server was restarted with another installation in between; a new
            // initialization event follows then. Or a transient failure: tried again next time.
            this.log(`[tsgo] Opening the TypeScript 7 API connection failed: ${error}`);
            return { enable: false, retryable: true };
        }
    }
}

function tsgoAndContentMapperEnabled(): boolean {
    return !!getUseTsgo() && !!contentMapperEnable();
}

function getUseTsgo(): boolean | undefined {
    const tsValue = getExplicitUseTsgo('typescript');
    const jsTsValue = getExplicitUseTsgo('js/ts');

    if (tsValue !== undefined || jsTsValue !== undefined) {
        const jsTsTarget = getExplicitConfigTarget(
            vscode.workspace.getConfiguration('js/ts'),
            'experimental.useTsgo'
        );
        const tsTarget = getExplicitConfigTarget(
            vscode.workspace.getConfiguration('typescript'),
            'experimental.useTsgo'
        );
        const mostSpecific = Math.max(
            jsTsTarget ?? vscode.ConfigurationTarget.Global,
            tsTarget ?? vscode.ConfigurationTarget.Global
        );
        return jsTsTarget === mostSpecific ? jsTsValue : tsValue;
    }

    return undefined;
}

function contentMapperEnable() {
    return vscode.workspace.getConfiguration('js/ts').get<boolean>('contentMappers.enabled', true);
}

function getExplicitConfigTarget(
    config: vscode.WorkspaceConfiguration,
    key: string
): vscode.ConfigurationTarget | undefined {
    const inspection = config.inspect(key);
    if (!inspection) return undefined;
    if (inspection.workspaceFolderValue !== undefined) {
        return vscode.ConfigurationTarget.WorkspaceFolder;
    }
    if (inspection.workspaceValue !== undefined) {
        return vscode.ConfigurationTarget.Workspace;
    }
    if (inspection.globalValue !== undefined) {
        return vscode.ConfigurationTarget.Global;
    }
    return undefined;
}

function getExplicitUseTsgo(section: string): boolean | undefined {
    const config = vscode.workspace.getConfiguration(section);
    const inspected = config.inspect<boolean>('experimental.useTsgo');
    if (!inspected) return undefined;

    const explicitValues: (boolean | undefined)[] = [
        inspected.workspaceFolderLanguageValue,
        inspected.workspaceLanguageValue,
        inspected.globalLanguageValue,
        inspected.workspaceFolderValue,
        inspected.workspaceValue,
        inspected.globalValue
    ];

    for (const v of explicitValues) {
        if (v !== undefined) {
            return v;
        }
    }
    return undefined;
}
