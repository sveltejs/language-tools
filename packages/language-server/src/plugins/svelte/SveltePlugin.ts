import { cosmiconfig } from 'cosmiconfig';
import { CompileOptions, Warning } from 'svelte/types/compiler/interfaces';
import {
    CompletionList,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    Position,
    Range,
    TextEdit,
    CodeActionContext,
    CodeAction,
} from 'vscode-languageserver';
import { Document, isInTag, mapDiagnosticToOriginal } from '../../lib/documents';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import { importPrettier, importSveltePreprocess } from '../importPackage';
import {
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
    CodeActionsProvider,
} from '../interfaces';
import { getCompletions } from './features/getCompletions';
import { getHoverInfo } from './features/getHoverInfo';
import { SvelteDocument, SvelteConfig, SvelteCompileResult } from './SvelteDocument';
import { Logger } from '../../logger';
import { getCodeActions } from './features/getCodeActions';

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true,
};

const NO_GENERATE: CompileOptions = {
    generate: false,
};

const scssNodeRuntimeHint =
    'If you use SCSS, it may be necessary to add the path to your NODE runtime to the setting `svelte.language-server.runtime`, or use `sass` instead of `node-sass`. ';

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

    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        try {
            return await this.tryGetDiagnostics(document);
        } catch (error) {
            Logger.error('Preprocessing failed');
            Logger.error(error);
            // Preprocessing could fail if packages like less/sass/babel cannot be resolved
            // when our fallback-version of svelte-preprocess is used.
            // Add a warning about a broken svelte.configs.js/preprocessor setup
            // Also add svelte-preprocess error message.
            const errorMsg =
                error instanceof Error && error.message.startsWith('Cannot find any of modules')
                    ? error.message + '. '
                    : '';
            const hint =
                error instanceof Error && error.message.includes('node-sass')
                    ? scssNodeRuntimeHint
                    : '';
            return [
                {
                    message:
                        errorMsg +
                        "The file cannot be parsed because script or style require a preprocessor that doesn't seem to be setup. " +
                        'Did you setup a `svelte.config.js`? ' +
                        hint +
                        'See https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.',
                    range: Range.create(Position.create(0, 0), Position.create(0, 5)),
                    severity: DiagnosticSeverity.Warning,
                    source: 'svelte',
                },
            ];
        }
    }

    private async tryGetDiagnostics(document: Document): Promise<Diagnostic[]> {
        const svelteDoc = await this.getSvelteDoc(document);
        const transpiled = await svelteDoc.getTranspiled();

        try {
            const res = await svelteDoc.getCompiled();
            return (((res.stats as any).warnings || res.warnings || []) as Warning[])
                .map((warning) => {
                    const start = warning.start || { line: 1, column: 0 };
                    const end = warning.end || start;
                    return {
                        range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                        message: warning.message,
                        severity: DiagnosticSeverity.Warning,
                        source: 'svelte',
                        code: warning.code,
                    };
                })
                .map((diag) => mapDiagnosticToOriginal(transpiled, diag));
        } catch (err) {
            return (await this.createParserErrorDiagnostic(err, document)).map((diag) =>
                mapDiagnosticToOriginal(transpiled, diag),
            );
        }
    }

    async getCompiledResult(document: Document): Promise<SvelteCompileResult | null> {
        try {
            const svelteDoc = await this.getSvelteDoc(document);
            return svelteDoc.getCompiledWith({ generate: 'dom' });
        } catch (error) {
            return null;
        }
    }

    private async createParserErrorDiagnostic(error: any, document: Document) {
        const start = error.start || { line: 1, column: 0 };
        const end = error.end || start;
        const diagnostic: Diagnostic = {
            range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
            message: error.message,
            severity: DiagnosticSeverity.Error,
            source: 'svelte',
            code: error.code,
        };

        if (diagnostic.message.includes('expected')) {
            const isInStyle = isInTag(diagnostic.range.start, document.styleInfo);
            const isInScript = isInTag(diagnostic.range.start, document.scriptInfo);

            if (isInStyle || isInScript) {
                diagnostic.message +=
                    '. If you expect this syntax to work, here are some suggestions: ';
                if (isInScript) {
                    diagnostic.message +=
                        'If you use typescript with `svelte-preprocessor`, did you add `lang="typescript"` to your `script` tag? ';
                } else {
                    diagnostic.message +=
                        'If you use less/SCSS with `svelte-preprocessor`, did you add `lang="scss"`/`lang="less"` to you `style` tag? ' +
                        scssNodeRuntimeHint;
                }
                diagnostic.message +=
                    'Did you setup a `svelte.config.js`? ' +
                    'See https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.';
            }
        }

        return [diagnostic];
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

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (!this.featureEnabled('format')) {
            return [];
        }

        const filePath = document.getFilePath()!;
        const prettier = importPrettier(filePath);
        const config = await prettier.resolveConfig(filePath);
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
}
