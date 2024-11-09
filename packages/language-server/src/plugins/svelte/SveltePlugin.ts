import { isAbsolute } from 'path';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeLens,
    CompletionContext,
    CompletionList,
    Diagnostic,
    FormattingOptions,
    Hover,
    Position,
    Range,
    SelectionRange,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { Plugin } from 'prettier';
import { getPackageInfo, importPrettier, importSvelte } from '../../importPackage';
import { Document } from '../../lib/documents';
import { Logger } from '../../logger';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import { isNotNullOrUndefined } from '../../utils';
import {
    CodeActionsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
    SelectionRangeProvider
} from '../interfaces';
import { executeCommand, getCodeActions } from './features/getCodeActions';
import { getCompletions } from './features/getCompletions';
import { getDiagnostics } from './features/getDiagnostics';
import { getHoverInfo } from './features/getHoverInfo';
import { getSelectionRange } from './features/getSelectionRanges';
import { SvelteCompileResult, SvelteDocument } from './SvelteDocument';

export class SveltePlugin
    implements
        DiagnosticsProvider,
        FormattingProvider,
        CompletionsProvider,
        HoverProvider,
        CodeActionsProvider,
        SelectionRangeProvider
{
    __name = 'svelte';
    private docManager = new Map<Document, SvelteDocument>();

    constructor(private configManager: LSConfigManager) {}

    async getCodeLens(document: Document): Promise<CodeLens[] | null> {
        if (!this.featureEnabled('runesLegacyModeCodeLens')) return null;

        const doc = await this.getSvelteDoc(document);
        if (!doc.isSvelte5) return null;

        try {
            const result = await doc.getCompiled();
            // @ts-ignore
            const runes = result.metadata.runes as boolean;

            return [
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 0 }
                    },
                    command: {
                        title: runes ? 'Runes mode' : 'Legacy mode',
                        command: 'svelte.openLink',
                        arguments: ['https://svelte.dev/docs/svelte/legacy-overview']
                    }
                }
            ];
        } catch (e) {
            // show an empty code lens in case of a compilation error to prevent code from jumping around
            return [
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 0 }
                    },
                    command: {
                        title: '',
                        command: ''
                    }
                }
            ];
        }
    }

    async getDiagnostics(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics') || !this.configManager.getIsTrusted()) {
            return [];
        }

        return getDiagnostics(
            document,
            await this.getSvelteDoc(document),
            this.configManager.getConfig().svelte.compilerWarnings,
            cancellationToken
        );
    }

    async getCompiledResult(document: Document): Promise<SvelteCompileResult | null> {
        try {
            const svelteDoc = await this.getSvelteDoc(document);
            // @ts-ignore is 'client' in Svelte 5
            return svelteDoc.getCompiledWith({ generate: 'dom' });
        } catch (error) {
            return null;
        }
    }

    async formatDocument(document: Document, options: FormattingOptions): Promise<TextEdit[]> {
        if (!this.featureEnabled('format')) {
            return [];
        }

        const filePath = document.getFilePath()!;

        /**
         * Prettier v2 can't use v3 plugins and vice versa. Therefore, we need to check
         * which version of prettier is used in the workspace and import the correct
         * version of the Svelte plugin. If user uses Prettier < 3 and has no Svelte plugin
         * then fall back to our built-in versions which are both v3 and compatible with
         * each other.
         */
        const importFittingPrettier = async () => {
            const getConfig = async (p: any) => {
                // Try resolving the config through prettier and fall back to possible editor config
                return this.configManager.getMergedPrettierConfig(
                    await p.resolveConfig(filePath, { editorconfig: true }),
                    // Be defensive here because IDEs other than VSCode might not have these settings
                    options && {
                        tabWidth: options.tabSize,
                        useTabs: !options.insertSpaces
                    }
                );
            };

            const prettier1 = importPrettier(filePath);
            const config1 = await getConfig(prettier1);
            const resolvedPlugins1 = resolvePlugins(config1.plugins);
            const pluginLoaded = await hasSveltePluginLoaded(prettier1, resolvedPlugins1);
            if (Number(prettier1.version[0]) >= 3 || pluginLoaded) {
                // plugin loaded, or referenced in user config as a plugin, or same version as our fallback version -> ok
                return {
                    prettier: prettier1,
                    config: config1,
                    isFallback: false,
                    resolvedPlugins: resolvedPlugins1
                };
            }

            // User either only has Plugin or incompatible Prettier major version installed or none
            // -> load our fallback version
            const prettier2 = importPrettier(__dirname);
            const config2 = await getConfig(prettier2);
            const resolvedPlugins2 = resolvePlugins(config2.plugins);
            return {
                prettier: prettier2,
                config: config2,
                isFallback: true,
                resolvedPlugins: resolvedPlugins2
            };
        };

        const { prettier, config, isFallback, resolvedPlugins } = await importFittingPrettier();

        // If user has prettier-plugin-svelte 1.x, then remove `options` from the sort
        // order or else it will throw a config error (`options` was not present back then).
        if (
            config?.svelteSortOrder &&
            getPackageInfo('prettier-plugin-svelte', filePath)?.version.major < 2
        ) {
            config.svelteSortOrder = config.svelteSortOrder
                .replace('-options', '')
                .replace('options-', '');
        }
        // If user has prettier-plugin-svelte 3.x, then add `options` from the sort
        // order or else it will throw a config error (now required).
        if (
            config?.svelteSortOrder &&
            !config.svelteSortOrder.includes('options') &&
            config.svelteSortOrder !== 'none' &&
            getPackageInfo('prettier-plugin-svelte', filePath)?.version.major >= 3
        ) {
            config.svelteSortOrder = 'options-' + config.svelteSortOrder;
        }
        // Take .prettierignore into account
        const fileInfo = await prettier.getFileInfo(filePath, {
            ignorePath: this.configManager.getPrettierConfig()?.ignorePath ?? '.prettierignore',
            // Sapper places stuff within src/node_modules, we want to format that, too
            withNodeModules: true
        });
        if (fileInfo.ignored) {
            Logger.debug('File is ignored, formatting skipped');
            return [];
        }

        if (isFallback || !(await hasSveltePluginLoaded(prettier, resolvedPlugins))) {
            // If the user uses Svelte 5 but doesn't have prettier installed, we need to provide
            // the compiler path to the plugin so it can use its parser method; else it will crash.
            const svelteCompilerInfo = getPackageInfo('svelte', filePath);
            if (svelteCompilerInfo.version.major >= 5) {
                config.svelte5CompilerPath = svelteCompilerInfo.path + '/compiler';
            }
        }

        // Prettier v3 format is async, v2 is not
        const formattedCode = await prettier.format(document.getText(), {
            ...config,
            plugins: Array.from(
                new Set([...resolvedPlugins, ...(await getSveltePlugin(resolvedPlugins))])
            ),
            parser: 'svelte' as any
        });

        return document.getText() === formattedCode
            ? []
            : [
                  TextEdit.replace(
                      Range.create(
                          document.positionAt(0),
                          document.positionAt(document.getTextLength())
                      ),
                      formattedCode
                  )
              ];

        async function getSveltePlugin(plugins: Array<string | Plugin> = []) {
            // Only provide our version of the svelte plugin if the user doesn't have one in
            // the workspace already. If we did it, Prettier would - for some reason - use
            // the workspace version for parsing and the extension version for printing,
            // which could crash if the contract of the parser output changed.
            return !isFallback && (await hasSveltePluginLoaded(prettier, plugins))
                ? []
                : [require.resolve('prettier-plugin-svelte')];
        }

        async function hasSveltePluginLoaded(
            p: typeof prettier,
            plugins: Array<Plugin | string> = []
        ) {
            if (plugins.some(SveltePlugin.isPrettierPluginSvelte)) return true;
            if (Number(p.version[0]) >= 3) return false; // Prettier version 3 has removed the "search plugins" feature
            // Prettier v3 getSupportInfo is async, v2 is not
            const info = await p.getSupportInfo();
            return info.languages.some((l) => l.name === 'svelte');
        }

        function resolvePlugins(plugins: Array<string | Plugin> | undefined) {
            return (plugins ?? []).map(resolvePlugin).filter(isNotNullOrUndefined);
        }

        function resolvePlugin(plugin: string | Plugin) {
            // https://github.com/prettier/prettier-vscode/blob/160b0e92d88fa19003dce2745d5ab8c67e886a04/src/ModuleResolver.ts#L373
            if (typeof plugin != 'string' || isAbsolute(plugin) || plugin.startsWith('.')) {
                return plugin;
            }

            try {
                return require.resolve(plugin, {
                    paths: [filePath]
                });
            } catch (error) {
                Logger.error(`failed to resolve plugin ${plugin} with error:\n`, error);
            }
        }
    }

    private static isPrettierPluginSvelte(plugin: string | Plugin): boolean {
        if (typeof plugin === 'string') {
            return plugin.includes('prettier-plugin-svelte');
        }

        return !!plugin?.languages?.find((l) => l.name === 'svelte');
    }

    async getCompletions(
        document: Document,
        position: Position,
        _?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const svelteDoc = await this.getSvelteDoc(document);
        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        return getCompletions(document, svelteDoc, position);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(document, await this.getSvelteDoc(document), position);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        const svelteDoc = await this.getSvelteDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        try {
            return getCodeActions(svelteDoc, range, context);
        } catch (error) {
            return [];
        }
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        if (command === 'migrate_to_svelte_5') {
            return this.migrate(document);
        }

        if (!this.featureEnabled('codeActions')) {
            return null;
        }

        const svelteDoc = await this.getSvelteDoc(document);
        try {
            return executeCommand(svelteDoc, command, args);
        } catch (error) {
            return null;
        }
    }

    private migrate(document: Document): WorkspaceEdit | string {
        try {
            const compiler = importSvelte(document.getFilePath() ?? '') as any;
            if (!compiler.migrate) {
                return 'Your installed Svelte version does not support migration';
            }

            const migrated = compiler.migrate(document.getText(), {
                filename: document.getFilePath() ?? undefined
            });

            return {
                changes: {
                    [document.uri]: [
                        TextEdit.replace(
                            Range.create(
                                document.positionAt(0),
                                document.positionAt(document.getTextLength())
                            ),
                            migrated.code
                        )
                    ]
                }
            };
        } catch (error: any) {
            Logger.error('Failed to migrate Svelte file', error);
            return error?.message ?? 'Failed to migrate Svelte file';
        }
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<SelectionRange | null> {
        if (!this.featureEnabled('selectionRange')) {
            return null;
        }

        const svelteDoc = await this.getSvelteDoc(document);

        return getSelectionRange(svelteDoc, position);
    }

    private featureEnabled(feature: keyof LSSvelteConfig) {
        return (
            this.configManager.enabled('svelte.enable') &&
            this.configManager.enabled(`svelte.${feature}.enable`)
        );
    }

    private async getSvelteDoc(document: Document) {
        let svelteDoc = this.docManager.get(document);
        if (!svelteDoc || svelteDoc.version !== document.version) {
            svelteDoc = new SvelteDocument(document);
            this.docManager.set(document, svelteDoc);
        }
        return svelteDoc;
    }
}
