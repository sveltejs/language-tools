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
        documentSymbols: { enable: true },
        codeActions: { enable: true },
        rename: { enable: true },
    },
    css: {
        enable: true,
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true },
        documentColors: { enable: true },
        colorPresentations: { enable: true },
        documentSymbols: { enable: true },
    },
    html: {
        enable: true,
        hover: { enable: true },
        completions: { enable: true },
        tagComplete: { enable: true },
        documentSymbols: { enable: true },
    },
    svelte: {
        enable: true,
        diagnostics: { enable: true },
        format: { enable: true },
        completions: { enable: true },
        hover: { enable: true },
    },
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

export interface LSSvelteConfig {
    enable: boolean;
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
}

export class LSConfigManager {
    private config: LSConfig = defaultLSConfig;

    /**
     * Updates config.
     */
    update(config: LSConfig): void {
        // Ideally we shouldn't need the merge here because all updates should be valid and complete configs.
        // But since those configs come from the client they might be out of synch with the valid config:
        // We might at some point in the future forget to synch config settings in all packages after updating the config.
        this.config = merge({}, defaultLSConfig, this.config, config);
    }

    /**
     * Whether or not specified config is enabled
     * @param key a string which is a path. Example: 'svelte.diagnostics.enable'.
     */
    enabled(key: string): boolean {
        return !!get(this.config, key);
    }
}

export const lsConfig = new LSConfigManager();
