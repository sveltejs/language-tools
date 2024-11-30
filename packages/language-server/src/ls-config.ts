import { get, merge } from 'lodash';
import ts from 'typescript';
import { VSCodeEmmetConfig } from '@vscode/emmet-helper';
import { importPrettier } from './importPackage';
import { Document } from './lib/documents';
import { returnObjectIfHasKeys } from './utils';
import path from 'path';
import { FileMap } from './lib/documents/fileCollection';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

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
        runesLegacyModeCodeLens: { enable: true },
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
    runesLegacyModeCodeLens: { enable: boolean };
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
    inlayHints?: TsInlayHintsConfig;
    referencesCodeLens?: TsReferenceCodeLensConfig;
    implementationsCodeLens?: TsImplementationCodeLensConfig;
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TsUserPreferencesConfig {
    importModuleSpecifier: ts.UserPreferences['importModuleSpecifierPreference'];
    importModuleSpecifierEnding: ts.UserPreferences['importModuleSpecifierEnding'];
    quoteStyle: ts.UserPreferences['quotePreference'];
    autoImportFileExcludePatterns: ts.UserPreferences['autoImportFileExcludePatterns'];

    /**
     * only in typescript config
     */
    includePackageJsonAutoImports?: ts.UserPreferences['includePackageJsonAutoImports'];

    preferTypeOnlyAutoImports?: ts.UserPreferences['preferTypeOnlyAutoImports'];

    autoImportSpecifierExcludeRegexes?: string[];

    organizeImports?: TsOrganizeImportPreferencesConfig;
}

interface TsOrganizeImportPreferencesConfig {
    accentCollation: ts.UserPreferences['organizeImportsAccentCollation'];
    caseFirst: ts.UserPreferences['organizeImportsCaseFirst'] | 'default';
    caseSensitivity: ts.UserPreferences['organizeImportsIgnoreCase'];
    collation: ts.UserPreferences['organizeImportsCollation'];
    locale: ts.UserPreferences['organizeImportsLocale'];
    numericCollation: ts.UserPreferences['organizeImportsNumericCollation'];
    typeOrder: ts.UserPreferences['organizeImportsTypeOrder'] | 'auto';
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TSSuggestConfig {
    autoImports: ts.UserPreferences['includeCompletionsForModuleExports'];
    includeAutomaticOptionalChainCompletions: boolean | undefined;
    includeCompletionsForImportStatements: boolean | undefined;
    classMemberSnippets: { enabled: boolean } | undefined;
    objectLiteralMethodSnippets: { enabled: boolean } | undefined;
    includeCompletionsWithSnippetText: boolean | undefined;
}

export type TsFormatConfig = Omit<
    ts.FormatCodeSettings,
    'indentMultiLineObjectLiteralBeginningOnBlankLine' | keyof ts.EditorSettings
>;
export interface TsInlayHintsConfig {
    enumMemberValues: { enabled: boolean } | undefined;
    functionLikeReturnTypes: { enabled: boolean } | undefined;
    parameterNames:
        | {
              enabled: ts.UserPreferences['includeInlayParameterNameHints'];
              suppressWhenArgumentMatchesName: boolean;
          }
        | undefined;
    parameterTypes: { enabled: boolean } | undefined;
    propertyDeclarationTypes: { enabled: boolean } | undefined;
    variableTypes: { enabled: boolean; suppressWhenTypeMatchesName: boolean } | undefined;
}

export interface TsReferenceCodeLensConfig {
    showOnAllFunctions?: boolean | undefined;
    enabled: boolean;
}

export interface TsImplementationCodeLensConfig {
    enabled: boolean;
    showOnInterfaceMethods?: boolean | undefined;
}

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

/**
 * The config as the vscode-html-languageservice understands it
 */
export interface HTMLConfig {
    customData?: string[];
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
        // populate default with _updateTsUserPreferences
        typescript: {},
        javascript: {}
    };
    private rawTsUserConfig: Record<TsUserConfigLang, TSUserConfig> = {
        typescript: {},
        javascript: {}
    };

    private resolvedAutoImportExcludeCache = new FileMap<string[]>();
    private tsFormatCodeOptions: Record<TsUserConfigLang, ts.FormatCodeSettings> = {
        typescript: this.getDefaultFormatCodeOptions(),
        javascript: this.getDefaultFormatCodeOptions()
    };
    private prettierConfig: any = {};
    private emmetConfig: VSCodeEmmetConfig = {};
    private cssConfig: CssConfig | undefined;
    private scssConfig: CssConfig | undefined;
    private lessConfig: CssConfig | undefined;
    private htmlConfig: HTMLConfig | undefined;
    private isTrusted = true;
    private clientCapabilities: ClientCapabilities | undefined;

    constructor() {
        this._updateTsUserPreferences('javascript', {});
        this._updateTsUserPreferences('typescript', {});
    }

    /**
     * Updates config.
     */
    update(config: DeepPartial<LSConfig> | undefined): void {
        // Ideally we shouldn't need the merge here because all updates should be valid and complete configs.
        // But since those configs come from the client they might be out of synch with the valid config:
        // We might at some point in the future forget to synch config settings in all packages after updating the config.
        this.config = merge({}, defaultLSConfig, this.config, config);
        // Merge will keep arrays/objects if the new one is empty/has less entries,
        // therefore we need some extra checks if there are new settings
        if (config?.svelte?.compilerWarnings) {
            this.config.svelte.compilerWarnings = config.svelte.compilerWarnings;
        }

        this.notifyListeners();
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
        this.notifyListeners();
    }

    getEmmetConfig(): VSCodeEmmetConfig {
        return this.emmetConfig;
    }

    updatePrettierConfig(config: any): void {
        this.prettierConfig = config || {};
        this.notifyListeners();
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
                this.rawTsUserConfig[lang] = config[lang];
            }
        });
        this.notifyListeners();
        this.resolvedAutoImportExcludeCache.clear();
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
        this.notifyListeners();
    }

    private _updateTsUserPreferences(lang: TsUserConfigLang, config: TSUserConfig) {
        const { inlayHints } = config;

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
            includeCompletionsWithInsertText: true,
            autoImportFileExcludePatterns: config.preferences?.autoImportFileExcludePatterns,
            useLabelDetailsInCompletionEntries: true,
            includeCompletionsWithSnippetText:
                config.suggest?.includeCompletionsWithSnippetText ?? true,
            includeCompletionsWithClassMemberSnippets:
                config.suggest?.classMemberSnippets?.enabled ?? true,
            includeCompletionsWithObjectLiteralMethodSnippets:
                config.suggest?.objectLiteralMethodSnippets?.enabled ?? true,
            preferTypeOnlyAutoImports: config.preferences?.preferTypeOnlyAutoImports,

            // Although we don't support incompletion cache.
            // But this will make ts resolve the module specifier more aggressively
            // Which also makes the completion label detail show up in more cases
            allowIncompleteCompletions: true,

            includeInlayEnumMemberValueHints: inlayHints?.enumMemberValues?.enabled,
            includeInlayFunctionLikeReturnTypeHints: inlayHints?.functionLikeReturnTypes?.enabled,
            includeInlayParameterNameHints: inlayHints?.parameterNames?.enabled,
            includeInlayParameterNameHintsWhenArgumentMatchesName:
                inlayHints?.parameterNames?.suppressWhenArgumentMatchesName === false,
            includeInlayFunctionParameterTypeHints: inlayHints?.parameterTypes?.enabled,
            includeInlayVariableTypeHints: inlayHints?.variableTypes?.enabled,
            includeInlayPropertyDeclarationTypeHints: inlayHints?.propertyDeclarationTypes?.enabled,
            includeInlayVariableTypeHintsWhenTypeMatchesName:
                inlayHints?.variableTypes?.suppressWhenTypeMatchesName === false,
            interactiveInlayHints: true,

            autoImportSpecifierExcludeRegexes:
                config.preferences?.autoImportSpecifierExcludeRegexes,

            organizeImportsAccentCollation: config.preferences?.organizeImports?.accentCollation,
            organizeImportsCollation: config.preferences?.organizeImports?.collation,
            organizeImportsCaseFirst: this.withDefaultAsUndefined(
                config.preferences?.organizeImports?.caseFirst,
                'default'
            ),
            organizeImportsIgnoreCase: this.withDefaultAsUndefined(
                config.preferences?.organizeImports?.caseSensitivity,
                'auto'
            ),
            organizeImportsLocale: config.preferences?.organizeImports?.locale,
            organizeImportsNumericCollation: config.preferences?.organizeImports?.numericCollation,
            organizeImportsTypeOrder: this.withDefaultAsUndefined(
                config.preferences?.organizeImports?.typeOrder,
                'auto'
            )
        };
    }

    private withDefaultAsUndefined<T, O extends T>(value: T, def: O): Exclude<T, O> | undefined {
        return value === def ? undefined : (value as Exclude<T, O>);
    }

    getTsUserPreferences(
        lang: TsUserConfigLang,
        normalizedWorkspacePath: string | null
    ): ts.UserPreferences {
        const userPreferences = this.tsUserPreferences[lang];

        if (!normalizedWorkspacePath || !userPreferences.autoImportFileExcludePatterns) {
            return userPreferences;
        }

        let autoImportFileExcludePatterns =
            this.resolvedAutoImportExcludeCache.get(normalizedWorkspacePath);

        if (!autoImportFileExcludePatterns) {
            const version = ts.version.split('.');
            const major = parseInt(version[0]);
            const minor = parseInt(version[1]);

            const gte5_4 = major > 5 || (major === 5 && minor >= 4);
            autoImportFileExcludePatterns = userPreferences.autoImportFileExcludePatterns.map(
                (p) => {
                    // Normalization rules: https://github.com/microsoft/TypeScript/pull/49578
                    const slashNormalized = p.replace(/\\/g, '/');
                    const isRelative = /^\.\.?($|\/)/.test(slashNormalized);
                    if (path.isAbsolute(p)) {
                        return p;
                    }

                    // https://github.com/microsoft/vscode/pull/202762
                    // ts 5.4+ supports leading wildcards
                    const wildcardPrefix = gte5_4 ? '' : path.parse(normalizedWorkspacePath).root;
                    return p.startsWith('*')
                        ? wildcardPrefix + slashNormalized
                        : isRelative
                          ? path.join(normalizedWorkspacePath, p)
                          : wildcardPrefix + '**/' + slashNormalized;
                }
            );
            this.resolvedAutoImportExcludeCache.set(
                normalizedWorkspacePath,
                autoImportFileExcludePatterns
            );
        }

        return {
            ...userPreferences,
            autoImportFileExcludePatterns
        };
    }

    getClientTsUserConfig(lang: TsUserConfigLang): TSUserConfig {
        return this.rawTsUserConfig[lang];
    }

    updateCssConfig(config: CssConfig | undefined): void {
        this.cssConfig = config;
        this.notifyListeners();
    }

    getCssConfig(): CssConfig | undefined {
        return this.cssConfig;
    }

    updateScssConfig(config: CssConfig | undefined): void {
        this.scssConfig = config;
        this.notifyListeners();
    }

    getScssConfig(): CssConfig | undefined {
        return this.scssConfig;
    }

    updateLessConfig(config: CssConfig | undefined): void {
        this.lessConfig = config;
        this.notifyListeners();
    }

    getLessConfig(): CssConfig | undefined {
        return this.lessConfig;
    }

    updateHTMLConfig(config: HTMLConfig | undefined): void {
        this.htmlConfig = config;
        this.notifyListeners();
    }

    getHTMLConfig(): HTMLConfig | undefined {
        return this.htmlConfig;
    }

    updateTsJsFormateConfig(config: Record<TsUserConfigLang, TSUserConfig>): void {
        (['typescript', 'javascript'] as const).forEach((lang) => {
            if (config[lang]) {
                this._updateTsFormatConfig(lang, config[lang]);
            }
        });
        this.notifyListeners();
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
                : ts.SemicolonPreference.Remove,
            tabSize: indentSize
        };
    }

    private scheduledUpdate: NodeJS.Timeout | undefined;
    private notifyListeners() {
        if (this.scheduledUpdate) {
            clearTimeout(this.scheduledUpdate);
        }
        this.scheduledUpdate = setTimeout(() => {
            this.scheduledUpdate = undefined;
            this.listeners.forEach((listener) => listener(this));
        });
    }

    updateClientCapabilities(clientCapabilities: ClientCapabilities) {
        this.clientCapabilities = clientCapabilities;
        this.notifyListeners();
    }

    getClientCapabilities() {
        return this.clientCapabilities;
    }
}
