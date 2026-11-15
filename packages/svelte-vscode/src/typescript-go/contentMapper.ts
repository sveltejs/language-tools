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

export interface ContentMapperStartResult {
    readonly enable: boolean;
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
    private readonly log: (message: string) => void = (message) => console.log(message);

    readonly onDidChangeEnablement = this.enablementEmitter.event;
    readonly onTsServerRestart = this.tsServerRestartEmitter.event;

    constructor(svelteExtension: vscode.Extension<any>) {
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

        this.api ??= (await tsGoExtension.activate()) as TsExtensionAPI;

        if (!this.configEnabled) {
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

            // should trigger immediately if the language server is already initialized
            disposables.push(
                this.api.onLanguageServerInitialized(this.onTsServerInitialized.bind(this))
            );

            this.contentMapperDisposables = disposables;
        }

        return (await this.svelteServerTsgoOption) ?? { enable: false };
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
     *
     * @param tsdk undefined when using older versions before tsdk is exposed
     * @returns
     */
    private onTsServerInitialized(tsdk: TypeScriptSDK | undefined): void {
        if (!this.configEnabled || !this.api) {
            return;
        }

        const firstInitialization = !this.svelteServerTsgoOption;
        this.svelteServerTsgoOption = this.updateSvelteServerTsgGoOption(tsdk);
        if (!firstInitialization) {
            this.tsServerRestartEmitter.fire();
        }
    }

    private async updateSvelteServerTsgGoOption(
        tsdk: TypeScriptSDK | undefined
    ): Promise<ContentMapperStartResult> {
        if (tsdk?.version) {
            const parts = tsdk.version.split('.');
            const major = parseInt(parts[0]);
            const minor = parseInt(parts[1]);
            if (!isNaN(major) && !isNaN(minor) && (major < 7 || (major === 7 && minor < 1))) {
                return { enable: false };
            }
        }

        const init =
            tsdk?.initializeAPIConnection ??
            // TODO: remove once the TypeScript 7 extension is updated
            (this.api as any)?.initializeAPIConnection;

        if (!init) {
            return { enable: false };
        }

        const pipe = await init();

        return {
            enable: true,
            apiPipe: pipe,
            typescriptPackageJsonPath: tsdk?.packageJsonPath
        };
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
