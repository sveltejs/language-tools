import { Document, DocumentManager } from './lib/documents';
import { LSConfigManager } from './ls-config';
import { CSSPlugin, PluginHost, SveltePlugin, TypeScriptPlugin } from './plugins';
import { Diagnostic } from 'vscode-languageserver';
import { Logger } from './logger';
import { urlToPath, pathToUrl } from './utils';

export type SvelteCheckDiagnosticSource = 'js' | 'css' | 'svelte';

export interface SvelteCheckOptions {
    compilerWarnings?: Record<string, 'ignore' | 'error'>;
    diagnosticSources?: SvelteCheckDiagnosticSource[];
}

/**
 * Small wrapper around PluginHost's Diagnostic Capabilities
 * for svelte-check, without the overhead of the lsp.
 */
export class SvelteCheck {
    private docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    private configManager = new LSConfigManager();
    private pluginHost = new PluginHost(this.docManager);

    constructor(workspacePath: string, options: SvelteCheckOptions = {}) {
        Logger.setLogErrorsOnly(true);
        this.initialize(workspacePath, options);
    }

    private initialize(workspacePath: string, options: SvelteCheckOptions) {
        this.configManager.update({
            svelte: {
                compilerWarnings: options.compilerWarnings
            }
        });
        // No HTMLPlugin, it does not provide diagnostics
        if (shouldRegister('svelte')) {
            this.pluginHost.register(new SveltePlugin(this.configManager));
        }
        if (shouldRegister('css')) {
            this.pluginHost.register(new CSSPlugin(this.docManager, this.configManager));
        }
        if (shouldRegister('js')) {
            this.pluginHost.register(
                new TypeScriptPlugin(this.docManager, this.configManager, [
                    pathToUrl(workspacePath)
                ])
            );
        }

        function shouldRegister(source: SvelteCheckDiagnosticSource) {
            return !options.diagnosticSources || options.diagnosticSources.includes(source);
        }
    }

    /**
     * Creates/updates given document
     *
     * @param doc Text and Uri of the document
     */
    upsertDocument(doc: { text: string; uri: string }) {
        this.docManager.openDocument({
            text: doc.text,
            uri: doc.uri
        });
        this.docManager.markAsOpenedInClient(doc.uri);
    }

    /**
     * Removes/closes document
     *
     * @param uri Uri of the document
     */
    removeDocument(uri: string) {
        this.docManager.closeDocument(uri);
        this.docManager.releaseDocument(uri);
    }

    /**
     * Gets the diagnostics for all currently open files.
     */
    async getDiagnostics(): Promise<
        Array<{ filePath: string; text: string; diagnostics: Diagnostic[] }>
    > {
        return await Promise.all(
            this.docManager.getAllOpenedByClient().map(async (doc) => {
                const uri = doc[1].uri;
                const diagnostics = await this.pluginHost.getDiagnostics({ uri });
                return {
                    filePath: urlToPath(uri) || '',
                    text: this.docManager.get(uri)?.getText() || '',
                    diagnostics
                };
            })
        );
    }
}
