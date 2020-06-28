import { cosmiconfig } from 'cosmiconfig';
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import {
    CodeAction,
    CodeActionContext,
    CompletionList,
    Diagnostic,
    Hover,
    Position,
    Range,
    TextEdit,
} from 'vscode-languageserver';
import { Document } from '../../lib/documents';
import { Logger } from '../../logger';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import { importPrettier, importSveltePreprocess } from '../importPackage';
import {
    CodeActionsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
} from '../interfaces';
import { getCodeActions } from './features/getCodeActions';
import { getCompletions } from './features/getCompletions';
import { getDiagnostics } from './features/getDiagnostics';
import { getHoverInfo } from './features/getHoverInfo';
import { SvelteCompileResult, SvelteConfig, SvelteDocument } from './SvelteDocument';

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true,
};

const NO_GENERATE: CompileOptions = {
    generate: false,
};
export class SveltePlugin
    implements
        DiagnosticsProvider,
        FormattingProvider,
        CompletionsProvider,
        HoverProvider,
        CodeActionsProvider {
    private docManager = new Map<Document, SvelteDocument>();
    private cosmiConfigExplorer = cosmiconfig('svelte', {
        packageProp: 'svelte-ls',
        cache: true,
    });

    constructor(private configManager: LSConfigManager, private prettierConfig: any) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        return getDiagnostics(document, await this.getSvelteDoc(document));
    }

    async getCompiledResult(document: Document): Promise<SvelteCompileResult | null> {
        try {
            const svelteDoc = await this.getSvelteDoc(document);
            return svelteDoc.getCompiledWith({ generate: 'dom' });
        } catch (error) {
            return null;
        }
    }

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (!this.featureEnabled('format')) {
            return [];
        }

        const filePath = document.getFilePath()!;
        const prettier = importPrettier(filePath);
        // Try resolving the config through prettier and fall back to possible editor config
        const config = (await prettier.resolveConfig(filePath)) || this.prettierConfig;
        const formattedCode = prettier.format(document.getText(), {
            ...config,
            plugins: [require.resolve('prettier-plugin-svelte')],
            parser: 'svelte' as any,
        });

        return [
            TextEdit.replace(
                Range.create(document.positionAt(0), document.positionAt(document.getTextLength())),
                formattedCode,
            ),
        ];
    }

    async getCompletions(document: Document, position: Position): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        return getCompletions(await this.getSvelteDoc(document), position);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(await this.getSvelteDoc(document), position);
    }

    async getCodeActions(
        document: Document,
        _range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        const svelteDoc = await this.getSvelteDoc(document);
        try {
            return getCodeActions(svelteDoc, context);
        } catch (error) {
            return [];
        }
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
            svelteDoc?.destroyTranspiled();
            // Reuse previous config. Assumption: Config does not change often (if at all).
            const config = svelteDoc?.config || (await this.loadConfig(document));
            svelteDoc = new SvelteDocument(document, config);
            this.docManager.set(document, svelteDoc);
        }
        return svelteDoc;
    }

    private async loadConfig(document: Document): Promise<SvelteConfig> {
        Logger.log('Trying to load config for', document.getFilePath());
        try {
            const result = await this.cosmiConfigExplorer.search(document.getFilePath() || '');
            const config = result?.config ?? this.useFallbackPreprocessor(document, false);
            if (result) {
                Logger.log('Found config at ', result.filepath);
            }
            return { ...DEFAULT_OPTIONS, ...config, ...NO_GENERATE };
        } catch (err) {
            Logger.error('Error while loading config');
            Logger.error(err);
            return {
                ...DEFAULT_OPTIONS,
                ...this.useFallbackPreprocessor(document, true),
                ...NO_GENERATE,
            };
        }
    }

    private useFallbackPreprocessor(document: Document, foundConfig: boolean) {
        if (
            document.styleInfo?.attributes.lang ||
            document.styleInfo?.attributes.type ||
            document.scriptInfo?.attributes.lang ||
            document.scriptInfo?.attributes.type
        ) {
            Logger.log(
                (foundConfig
                    ? 'Found svelte.config.js but there was an error loading it. '
                    : 'No svelte.config.js found but one is needed. ') +
                    'Using https://github.com/sveltejs/svelte-preprocess as fallback',
            );
            return {
                preprocess: importSveltePreprocess(document.getFilePath() || '')({
                    typescript: { transpileOnly: true },
                }),
            };
        }
        return {};
    }
}
