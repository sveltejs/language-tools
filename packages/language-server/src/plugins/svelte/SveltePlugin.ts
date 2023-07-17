import { isAbsolute } from 'path';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
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
import { getPackageInfo, importPrettier } from '../../importPackage';
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

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics') || !this.configManager.getIsTrusted()) {
            return [];
        }

        return getDiagnostics(
            document,
            await this.getSvelteDoc(document),
            this.configManager.getConfig().svelte.compilerWarnings
        );
    }

    async getCompiledResult(document: Document): Promise<SvelteCompileResult | null> {
        try {
            const svelteDoc = await this.getSvelteDoc(document);
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
        const prettier = await importFittingPrettier();
        // Try resolving the config through prettier and fall back to possible editor config
        const config = this.configManager.getMergedPrettierConfig(
            await prettier.resolveConfig(filePath, { editorconfig: true }),
            // Be defensive here because IDEs other than VSCode might not have these settings
            options && {
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces
            }
        );
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

        // Prettier v3 format is async, v2 is not
        const formattedCode = await prettier.format(document.getText(), {
            ...config,
            plugins: Array.from(
                new Set([
                    ...((config.plugins as string[]) ?? [])
                        .map(resolvePlugin)
                        .filter(isNotNullOrUndefined),
                    ...(await getSveltePlugin())
                ])
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

        async function getSveltePlugin() {
            // Only provide our version of the svelte plugin if the user doesn't have one in
            // the workspace already. If we did it, Prettier would - for some reason - use
            // the workspace version for parsing and the extension version for printing,
            // which could crash if the contract of the parser output changed.
            const hasPluginLoadedAlready = await hasSveltePluginLoaded(prettier);
            return hasPluginLoadedAlready ? [] : [require.resolve('prettier-plugin-svelte')];
        }

        /**
         * Prettier v2 can't use v3 plugins and vice versa. Therefore, we need to check
         * which version of prettier is used in the workspace and import the correct
         * version of the Svelte plugin. If user uses Prettier >= 3 and has no Svelte plugin
         * then fall back to our built-in versions which are both v2 and compatible with
         * each other.
         * TODO switch this around at some point to load Prettier v3 by default because it's
         * more likely that users have that installed.
         */
        async function importFittingPrettier() {
            const prettier = importPrettier(filePath);
            if (Number(prettier.version[0]) < 3 || (await hasSveltePluginLoaded(prettier))) {
                return prettier;
            }
            return importPrettier('.');
        }

        async function hasSveltePluginLoaded(p: typeof prettier) {
            // Prettier v3 getSupportInfo is async, v2 is not
            return (await p.getSupportInfo()).languages.some((l) => l.name === 'svelte');
        }

        function resolvePlugin(plugin: string) {
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
