import { merge, get } from 'lodash';
import { UserPreferences } from 'typescript';
import { VSCodeEmmetConfig } from 'vscode-emmet-helper';

/**
 * Default config for the language server.
 */
const defaultLSConfig: LSConfig = {
    typescript: {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        definitions: { enable: true },
        findReferences: { enable: true },
        documentSymbols: { enable: true },
        codeActions: { enable: true },
        rename: { enable: true },
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
        renameTags: { enable: true },
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
        selectionRange: { enable: true }
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
    findReferences: {
        enable: boolean;
    };
    definitions: {
        enable: boolean;
    };
    codeActions: {
        enable: boolean;
    };
    rename: {
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
    renameTags: {
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
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 * It may not be available in other IDEs, that's why the keys are optional.
 */
export interface TSUserConfig {
    preferences?: TsUserPreferencesConfig;
    suggest?: TSSuggestConfig;
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TsUserPreferencesConfig {
    importModuleSpecifier: UserPreferences['importModuleSpecifierPreference'];
    importModuleSpecifierEnding: UserPreferences['importModuleSpecifierEnding'];
    quoteStyle: UserPreferences['quotePreference'];
    /**
     * only in typescript config
     */
    includePackageJsonAutoImports?: UserPreferences['includePackageJsonAutoImports'];
}

/**
 * A subset of the JS/TS VS Code settings which
 * are transformed to ts.UserPreferences.
 */
export interface TSSuggestConfig {
    autoImports: UserPreferences['includeCompletionsForModuleExports'];
}

export type TsUserConfigLang = 'typescript' | 'javascript';

type DeepPartial<T> = T extends CompilerWarningsSettings
    ? T
    : {
          [P in keyof T]?: DeepPartial<T[P]>;
      };

export class LSConfigManager {
    private config: LSConfig = defaultLSConfig;
    private listeners: Array<(config: LSConfigManager) => void> = [];
    private tsUserPreferences: Record<TsUserConfigLang, UserPreferences> = {
        typescript: {
            includeCompletionsForModuleExports: true
        },
        javascript: {
            includeCompletionsForModuleExports: true
        }
    };
    private prettierConfig: any = {};
    private emmetConfig: VSCodeEmmetConfig = {};

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
    }

    getEmmetConfig(): VSCodeEmmetConfig {
        return this.emmetConfig;
    }

    updatePrettierConfig(config: any): void {
        this.prettierConfig = config || {};
    }

    getPrettierConfig(): any {
        return this.prettierConfig;
    }

    updateTsJsUserPreferences(config: Record<TsUserConfigLang, TSUserConfig>): void {
        (['typescript', 'javascript'] as const).forEach((lang) => {
            if (config[lang]) {
                this._updateTsUserPreferences(lang, config[lang]);
            }
        });
    }

    private _updateTsUserPreferences(lang: TsUserConfigLang, config: TSUserConfig) {
        this.tsUserPreferences[lang] = {
            ...this.tsUserPreferences[lang],
            importModuleSpecifierPreference: config.preferences?.importModuleSpecifier,
            importModuleSpecifierEnding: config.preferences?.importModuleSpecifierEnding,
            includePackageJsonAutoImports: config.preferences?.includePackageJsonAutoImports,
            quotePreference: config.preferences?.quoteStyle,
            includeCompletionsForModuleExports: config.suggest?.autoImports ?? true
        };
    }

    getTsUserPreferences(lang: TsUserConfigLang) {
        return this.tsUserPreferences[lang];
    }
}

export const lsConfig = new LSConfigManager();
