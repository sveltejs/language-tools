import { cosmiconfig } from 'cosmiconfig';
import { CompileOptions, Warning, Ast as SvelteAst } from 'svelte/types/compiler/interfaces';
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess';
import {
    CompletionList,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    Position,
    Range,
    TextEdit,
} from 'vscode-languageserver';
import { Document, isInTag, mapDiagnosticToOriginal } from '../../lib/documents';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import { importPrettier, importSvelte, importSveltePreprocess } from '../importPackage';
import {
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
    Resolvable,
} from '../interfaces';
import { getCompletions } from './features/getCompletions';
import { getHoverInfo } from './features/getHoverInfo';
import { SvelteDocument, TranspiledSvelteDocument } from './SvelteDocument';
import { Logger } from '../../logger';

export type SvelteCompiledResult = {
    js: any;
    css: any;
    ast: SvelteAst;
    warnings: Warning[];
    vars: {
        name: string;
        export_name: string;
        injected: boolean;
        module: boolean;
        mutated: boolean;
        reassigned: boolean;
        referenced: boolean;
        writable: boolean;
        referenced_from_script: boolean;
    }[];
    stats: {
        timings: {
            total: number;
        };
    };
};

interface SvelteConfig extends CompileOptions {
    preprocess?: PreprocessorGroup;
}

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true,
};

const scssNodeRuntimeHint =
    'If you use SCSS, it may be necessary to add the path to your NODE runtime to the setting `svelte.language-server.runtime`, or use `sass` instead of `node-sass`. ';

export class SveltePlugin
    implements DiagnosticsProvider, FormattingProvider, CompletionsProvider, HoverProvider {
    private docManager = new Map<Document, SvelteDocument>();

    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const res = await this.getCompiledResult(document, true);
        return res.diagnostics;
    }

    async getCompiledResult(
        document: Document,
        includeDiagnostics: boolean,
    ): Promise<{
        compiled: SvelteCompiledResult | null;
        diagnostics: Diagnostic[];
    }> {
        const svelteDoc = this.getSvelteDoc(document);
        const config = await this.loadConfig(document);
        const svelte = importSvelte(svelteDoc.getFilePath());
        let transpiled: TranspiledSvelteDocument = null as any;
        let diagnostics: Diagnostic[] = [];

        try {
            transpiled = await svelteDoc.getTranspiled(config.preprocess);
        } catch (error) {
            Logger.error('Preprocessing failed');
            Logger.error(error);
            if (includeDiagnostics) {
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
                diagnostics.push({
                    message:
                        errorMsg +
                        "The file cannot be parsed because script or style require a preprocessor that doesn't seem to be setup. " +
                        'Did you setup a `svelte.config.js`? ' +
                        hint +
                        'See https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.',
                    range: Range.create(Position.create(0, 0), Position.create(0, 5)),
                    severity: DiagnosticSeverity.Warning,
                    source: 'svelte',
                });
            }
        }

        if (!transpiled) {
            return {
                compiled: null,
                diagnostics,
            };
        }

        try {
            delete config.preprocess; // svelte compiler throws an error if we don't do this
            const res = svelte.compile(transpiled.getText(), config);
            return {
                compiled: res,
                diagnostics,
            };
        } catch (error) {
            if (includeDiagnostics) {
                diagnostics = (
                    await this.createParserErrorDiagnostic(error, document)
                ).map((diag) => mapDiagnosticToOriginal(transpiled, diag));
            }

            return {
                compiled: null,
                diagnostics,
            };
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

    private async loadConfig(document: Document): Promise<SvelteConfig> {
        Logger.log('Trying to load config for', document.getFilePath());
        try {
            const explorer = cosmiconfig('svelte', { packageProp: 'svelte-ls' });
            const result = await explorer.search(document.getFilePath() || '');
            const config = result?.config ?? this.useFallbackPreprocessor(document);
            if (result) {
                Logger.log('Found config at ', result.filepath);
            }
            return { ...DEFAULT_OPTIONS, ...config };
        } catch (err) {
            Logger.error('Error while loading config');
            Logger.error(err);
            return { ...DEFAULT_OPTIONS, ...this.useFallbackPreprocessor(document) };
        }
    }

    private useFallbackPreprocessor(document: Document) {
        if (
            document.styleInfo?.attributes.lang ||
            document.styleInfo?.attributes.type ||
            document.scriptInfo?.attributes.lang ||
            document.scriptInfo?.attributes.type
        ) {
            Logger.log(
                'No svelte.config.js found but one is needed. ' +
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

    getCompletions(document: Document, position: Position): Resolvable<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        return getCompletions(this.getSvelteDoc(document), position);
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(this.getSvelteDoc(document), position);
    }

    private featureEnabled(feature: keyof LSSvelteConfig) {
        return (
            this.configManager.enabled('svelte.enable') &&
            this.configManager.enabled(`svelte.${feature}.enable`)
        );
    }

    private getSvelteDoc(document: Document) {
        let svelteDoc = this.docManager.get(document);
        if (!svelteDoc || svelteDoc.version !== document.version) {
            svelteDoc?.destroyTranspiled();
            svelteDoc = new SvelteDocument(document);
            this.docManager.set(document, svelteDoc);
        }
        return svelteDoc;
    }
}
