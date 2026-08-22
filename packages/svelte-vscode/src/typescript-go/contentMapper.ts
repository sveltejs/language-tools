import * as vscode from 'vscode';

interface TsExtensionAPI {
    onLanguageServerInitialized: vscode.Event<void>;
    initializeAPIConnection(pipe?: string): Promise<string>;
    registerContentMappers(
        contributorId: string,
        contributions: readonly ContentMapperContribution[]
    ): vscode.Disposable;
}

interface ContentMapperContribution {
    readonly extensions: readonly string[];
    readonly inferredProjectContribution?: {
        readonly options?: Readonly<Record<string, unknown>>;
        readonly manifest: ContentMapperManifest;
    };
}

interface ContentMapperManifest {
    readonly name: string;
    readonly version?: string;
    readonly exec: readonly string[];
    readonly cwd?: vscode.Uri;
    readonly compilerOptions?: readonly string[];
    readonly dynamicConfig?: boolean;
}

export interface ContentMapperOptions {
    readonly enable: boolean;
}

export async function discoverTsContentMapper(
    svelteExtensionId: string
): Promise<ContentMapperOptions> {
    if (!getUseTsgo()) {
        return { enable: false };
    }

    const extension =
        // dev version is currently this extension id, maybe the published version might change in the future?
        vscode.extensions.getExtension('TypeScriptTeam.vscode-typescript') ??
        vscode.extensions.getExtension('TypeScriptTeam.native-preview');

    if (!extension) {
        return { enable: false };
    }

    const api = (await extension.activate()) as TsExtensionAPI;

    if (!(api && 'registerContentMappers' in api)) {
        // TODO: might want to build a hybrid solution in this case, since we don't know when the extension will be updated to support the new API.
        return { enable: false };
    }

    api.registerContentMappers(svelteExtensionId, [
        {
            extensions: ['.svelte']
            // inferredProjectContribution: {
            //     manifest: {
            //         name: 'svelte',
            //         exec: ['node', 'path/to/mapper.js']
            //     }
            // }
        }
    ]);

    return { enable: true };
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
