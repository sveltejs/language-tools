import { get, merge } from 'lodash';
import ts from 'typescript';
import { VSCodeEmmetConfig } from '@vscode/emmet-helper';
import { importPrettier } from './importPackage';
import { Document } from './lib/documents';
import { returnObjectIfHasKeys } from './utils';

/**
 * Default config for the language server.
 */
const defaultLSConfig: LSConfig = {
    typescript: {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        documentSymbols: { enable: true },
        codeActions: { enable: true },
        selectionRange: { enable: true },
        signatureHelp: { enable: true },
        semanticTokens: { enable: true }
    },
    css: {
        enable: true,
        globals: '',
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true, emmet: true },
        documentColors: { enable: true },
        colorPresentations: { enable: true },
        documentSymbols: { enable: true },
        selectionRange: { enable: true }
    },
    html: {
        enable: true,
        hover: { enable: true },
        completions: { enable: true, emmet: true },
        tagComplete: { enable: true },
        documentSymbols: { enable: true },
        linkedEditing: { enable: true }
    },
    svelte: {
        enable: true,
        useNewTransformation: true,
        compilerWarnings: {},
        diagnostics: { enable: true },
        rename: { enable: true },
        format: {
            enable: true,
            config: {
                svelteSortOrder: 'options-scripts-markup-styles',
                svelteStrictMode: false,
                svelteAllowShorthand: true,
                svelteBracketNewLine: true,
                svelteIndentScriptAndStyle: true,
                printWidth: 80,
                singleQuote: false
            }
        },
        completions: { enable: true },
        hover: { enable: true },
        codeActions: { enable: true },
        selectionRange: { enable: true },
        defaultScriptLanguage: 'none'
    }
};

/**
 * Representation of the language server config.
 * Should be kept in sync with infos in `packages/svelte-vscode/package.json`.
 */
export interface LSConfig {
    typescript: LSTypescriptConfig;
    css: LSCSSConfig;
    html: LSHTMLConfig;
    svelte: LSSvelteConfig;
}

export interface LSTypescriptConfig {
    enable: boolean;
    diagnostics: {
        enable: boolean;
    };
    hover: {
        enable: boolean;
    };
    documentSymbols: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
    };
    codeActions: {
        enable: boolean;
    };
    selectionRange: {
        enable: boolean;
    };
    signatureHelp: {
        enable: boolean;
    };
    semanticTokens: {
        enable: boolean;
    };
}

export interface LSCSSConfig {
    enable: boolean;
    globals: string;
    diagnostics: {
        enable: boolean;
    };
    hover: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
        emmet: boolean;
    };
    documentColors: {
        enable: boolean;
    };
    colorPresentations: {
        enable: boolean;
    };
    documentSymbols: {
        enable: boolean;
    };
    selectionRange: {
        enable: boolean;
    };
}

export interface LSHTMLConfig {
    enable: boolean;
    hover: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
        emmet: boolean;
    };
    tagComplete: {
        enable: boolean;
    };
    documentSymbols: {
        enable: boolean;
    };
    linkedEditing: {
        enable: boolean;
    };
}

export type CompilerWarningsSettings = Record<string, 'ignore' | 'error'>;

export interface LSSvelteConfig {
    enable: boolean;
    useNewTransformation: boolean;
    compilerWarnings: CompilerWarningsSettings;
    diagnostics: {
        enable: boolean;
    };
    format: {
        enable: boolean;
        config: {
            svelteSortOrder: string;
            svelteStrictMode: boolean;
            svelteAllowShorthand: boolean;
            svelteBracketNewLine: boolean;
            svelteIndentScriptAndStyle: boolean;
            printWidth: number;
            singleQuote: boolean;
        };
    };
    rename: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
    };
    hover: {
        enable: boolean;
    };
    codeActions: {
        enable: boolean;
    };
    selectionRange: {
        enable: boolean;
    };
    defaultScriptLanguage: 'none' | 'ts';
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 * It may not be available in other IDEs, that's why the keys are optional.
 */
export interface TSUserConfig {
    preferences?: TsUserPreferencesConfig;
    suggest?: TSSuggestConfig;
    format?: TsFormatConfig;
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TsUserPreferencesConfig {
    importModuleSpecifier: ts.UserPreferences['importModuleSpecifierPreference'];
    importModuleSpecifierEnding: ts.UserPreferences['importModuleSpecifierEnding'];
    quoteStyle: ts.UserPreferences['quotePreference'];
    /**
     * only in typescript config
     */
    includePackageJsonAutoImports?: ts.UserPreferences['includePackageJsonAutoImports'];
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TSSuggestConfig {
    autoImports: ts.UserPreferences['includeCompletionsForModuleExports'];
    includeAutomaticOptionalChainCompletions: boolean | undefined;
    includeCompletionsForImportStatements: boolean | undefined;
}

export type TsFormatConfig = Omit<
    ts.FormatCodeSettings,
    'indentMultiLineObjectLiteralBeginningOnBlankLine' | keyof ts.EditorSettings
>;

export type TsUserConfigLang = 'typescript' | 'javascript';

/**
 * The config as the vscode-css-languageservice understands it
 */
export interface CssConfig {
    validate?: boolean;
    lint?: any;
    completion?: any;
    hover?: any;
}

type DeepPartial<T> = T extends CompilerWarningsSettings
    ? T
    : {
          [P in keyof T]?: DeepPartial<T[P]>;
      };

export class LSConfigManager {
    private config: LSConfig = defaultLSConfig;
    private listeners: Array<(config: LSConfigManager) => void> = [];
    private tsUserPreferences: Record<TsUserConfigLang, ts.UserPreferences> = {
        typescript: {
            includeCompletionsForModuleExports: true,
            includeCompletionsForImportStatements: true,
            includeCompletionsWithInsertText: true,
            includeAutomaticOptionalChainCompletions: true
        },
        javascript: {
            includeCompletionsForModuleExports: true,
            includeCompletionsForImportStatements: true,
            includeCompletionsWithInsertText: true,
            includeAutomaticOptionalChainCompletions: true
        }
    };
    private tsFormatCodeOptions: Record<TsUserConfigLang, ts.FormatCodeSettings> = {
        typescript: this.getDefaultFormatCodeOptions(),
        javascript: this.getDefaultFormatCodeOptions()
    };
    private prettierConfig: any = {};
    private emmetConfig: VSCodeEmmetConfig = {};
    private cssConfig: CssConfig | undefined;
    private scssConfig: CssConfig | undefined;
    private lessConfig: CssConfig | undefined;
    private isTrusted = true;

    /**
     * Updates config.
     */
    update(config: DeepPartial<LSConfig>): void {
        // Ideally we shouldn't need the merge here because all updates should be valid and complete configs.
        // But since those configs come from the client they might be out of synch with the valid config:
        // We might at some point in the future forget to synch config settings in all packages after updating the config.
        this.config = merge({}, defaultLSConfig, this.config, config);
        // Merge will keep arrays/objects if the new one is empty/has less entries,
        // therefore we need some extra checks if there are new settings
        if (config.svelte?.compilerWarnings) {
            this.config.svelte.compilerWarnings = config.svelte.compilerWarnings;
        }
        // TODO remove once we remove old transformation
        this.config.svelte.useNewTransformation = true;

        this.listeners.forEach((listener) => listener(this));
    }

    /**
     * Whether or not specified config is enabled
     * @param key a string which is a path. Example: 'svelte.diagnostics.enable'.
     */
    enabled(key: string): boolean {
        return !!this.get(key);
    }

    /**
     * Get specific config
     * @param key a string which is a path. Example: 'svelte.diagnostics.enable'.
     */
    get<T>(key: string): T {
        return get(this.config, key);
    }

    /**
     * Get the whole config
     */
    getConfig(): Readonly<LSConfig> {
        return this.config;
    }

    /**
     * Register a listener which is invoked when the config changed.
     */
    onChange(callback: (config: LSConfigManager) => void): void {
        this.listeners.push(callback);
    }

    updateEmmetConfig(config: VSCodeEmmetConfig): void {
        this.emmetConfig = config || {};
        this.listeners.forEach((listener) => listener(this));
    }

    getEmmetConfig(): VSCodeEmmetConfig {
        return this.emmetConfig;
    }

    updatePrettierConfig(config: any): void {
        this.prettierConfig = config || {};
        this.listeners.forEach((listener) => listener(this));
    }

    getPrettierConfig(): any {
        return this.prettierConfig;
    }

    /**
     * Returns a merged Prettier config following these rules:
     * - If `prettierFromFileConfig` exists, that one is returned
     * - Else the Svelte extension's Prettier config is used as a starting point,
     *   and overridden by a possible Prettier config from the Prettier extension,
     *   or, if that doesn't exist, a possible fallback override.
     */
    getMergedPrettierConfig(
        prettierFromFileConfig: any,
        overridesWhenNoPrettierConfig: any = {}
    ): any {
        return (
            returnObjectIfHasKeys(prettierFromFileConfig) ||
            merge(
                {}, // merge into empty obj to not manipulate own config
                this.get('svelte.format.config'),
                returnObjectIfHasKeys(this.getPrettierConfig()) ||
                    overridesWhenNoPrettierConfig ||
                    {}
            )
        );
    }

    updateTsJsUserPreferences(config: Record<TsUserConfigLang, TSUserConfig>): void {
        (['typescript', 'javascript'] as const).forEach((lang) => {
            if (config[lang]) {
                this._updateTsUserPreferences(lang, config[lang]);
            }
        });
        this.listeners.forEach((listener) => listener(this));
    }

    /**
     * Whether or not the current workspace can be trusted.
     * If not, certain operations should be disabled.
     */
    getIsTrusted(): boolean {
        return this.isTrusted;
    }

    updateIsTrusted(isTrusted: boolean): void {
        this.isTrusted = isTrusted;
        this.listeners.forEach((listener) => listener(this));
    }

    private _updateTsUserPreferences(lang: TsUserConfigLang, config: TSUserConfig) {
        this.tsUserPreferences[lang] = {
            ...this.tsUserPreferences[lang],
            importModuleSpecifierPreference: config.preferences?.importModuleSpecifier,
            importModuleSpecifierEnding: config.preferences?.importModuleSpecifierEnding,
            includePackageJsonAutoImports: config.preferences?.includePackageJsonAutoImports,
            quotePreference: config.preferences?.quoteStyle,
            includeCompletionsForModuleExports: config.suggest?.autoImports ?? true,
            includeCompletionsForImportStatements:
                config.suggest?.includeCompletionsForImportStatements ?? true,
            includeAutomaticOptionalChainCompletions:
                config.suggest?.includeAutomaticOptionalChainCompletions ?? true,
            includeCompletionsWithInsertText: true
        };
    }

    getTsUserPreferences(lang: TsUserConfigLang) {
        return this.tsUserPreferences[lang];
    }

    updateCssConfig(config: CssConfig | undefined): void {
        this.cssConfig = config;
        this.listeners.forEach((listener) => listener(this));
    }

    getCssConfig(): CssConfig | undefined {
        return this.cssConfig;
    }

    updateScssConfig(config: CssConfig | undefined): void {
        this.scssConfig = config;
        this.listeners.forEach((listener) => listener(this));
    }

    getScssConfig(): CssConfig | undefined {
        return this.scssConfig;
    }

    updateLessConfig(config: CssConfig | undefined): void {
        this.lessConfig = config;
        this.listeners.forEach((listener) => listener(this));
    }

    getLessConfig(): CssConfig | undefined {
        return this.lessConfig;
    }

    updateTsJsFormateConfig(config: Record<TsUserConfigLang, TSUserConfig>): void {
        (['typescript', 'javascript'] as const).forEach((lang) => {
            if (config[lang]) {
                this._updateTsFormatConfig(lang, config[lang]);
            }
        });
        this.listeners.forEach((listener) => listener(this));
    }

    private getDefaultFormatCodeOptions(): ts.FormatCodeSettings {
        // https://github.com/microsoft/TypeScript/blob/394f51aeed80788dca72c6f6a90d1d27886b6972/src/services/types.ts#L1014
        return {
            indentSize: 4,
            tabSize: 4,
            convertTabsToSpaces: true,
            indentStyle: ts.IndentStyle.Smart,
            insertSpaceAfterConstructor: false,
            insertSpaceAfterCommaDelimiter: true,
            insertSpaceAfterSemicolonInForStatements: true,
            insertSpaceBeforeAndAfterBinaryOperators: true,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
            insertSpaceBeforeFunctionParenthesis: false,
            placeOpenBraceOnNewLineForFunctions: false,
            placeOpenBraceOnNewLineForControlBlocks: false,
            trimTrailingWhitespace: true,
            semicolons: ts.SemicolonPreference.Ignore,

            // Override TypeScript's default because VSCode default to true
            // Also this matches the style of prettier
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: true
        };
    }

    private _updateTsFormatConfig(lang: TsUserConfigLang, config: TSUserConfig) {
        this.tsFormatCodeOptions[lang] = {
            ...this.tsFormatCodeOptions[lang],
            ...(config.format ?? {})
        };
    }

    async getFormatCodeSettingsForFile(
        document: Document,
        scriptKind: ts.ScriptKind
    ): Promise<ts.FormatCodeSettings> {
        const filePath = document.getFilePath();
        const configLang =
            scriptKind === ts.ScriptKind.TS || scriptKind === ts.ScriptKind.TSX
                ? 'typescript'
                : 'javascript';

        const tsFormatCodeOptions = this.tsFormatCodeOptions[configLang];

        if (!filePath) {
            return tsFormatCodeOptions;
        }

        const prettierConfig = this.getMergedPrettierConfig(
            await importPrettier(filePath).resolveConfig(filePath, {
                editorconfig: true
            })
        );
        const useSemicolons = prettierConfig.semi ?? true;
        const documentUseLf =
            document.getText().includes('\n') && !document.getText().includes('\r\n');

        const indentSize =
            (typeof prettierConfig.tabWidth === 'number' ? prettierConfig.tabWidth : null) ??
            tsFormatCodeOptions.tabSize;

        return {
            ...tsFormatCodeOptions,

            newLineCharacter: documentUseLf ? '\n' : ts.sys.newLine,
            baseIndentSize: prettierConfig.svelteIndentScriptAndStyle === false ? 0 : indentSize,
            indentSize,
            convertTabsToSpaces: !prettierConfig.useTabs,
            semicolons: useSemicolons
                ? ts.SemicolonPreference.Insert
                : ts.SemicolonPreference.Remove
        };
    }
}

export const lsConfig = new LSConfigManager();
