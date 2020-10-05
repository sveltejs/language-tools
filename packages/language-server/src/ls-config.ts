import { merge, get } from 'lodash';

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
        rename: { enable: true }
    },
    css: {
        enable: true,
        globals: '',
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        documentColors: { enable: true },
        colorPresentations: { enable: true },
        documentSymbols: { enable: true }
    },
    html: {
        enable: true,
        hover: { enable: true },
        completions: { enable: true },
        tagComplete: { enable: true },
        documentSymbols: { enable: true }
    },
    svelte: {
        enable: true,
        compilerWarnings: {},
        diagnostics: { enable: true },
        format: { enable: true },
        completions: { enable: true },
        hover: { enable: true },
        codeActions: { enable: true }
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
}

export interface LSHTMLConfig {
    enable: boolean;
    hover: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
    };
    tagComplete: {
        enable: boolean;
    };
    documentSymbols: {
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
}

type DeepPartial<T> = T extends CompilerWarningsSettings
    ? T
    : {
          [P in keyof T]?: DeepPartial<T[P]>;
      };

export class LSConfigManager {
    private config: LSConfig = defaultLSConfig;
    private listeners: Array<(config: LSConfigManager) => void> = [];

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
}

export const lsConfig = new LSConfigManager();
