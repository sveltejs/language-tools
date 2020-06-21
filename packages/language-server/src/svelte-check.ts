import { Document, DocumentManager } from './lib/documents';
import { LSConfigManager } from './ls-config';
import { CSSPlugin, HTMLPlugin, PluginHost, SveltePlugin, TypeScriptPlugin } from './plugins';
import { Diagnostic } from 'vscode-languageserver';
import { Logger } from './logger';

/**
 * Small wrapper around PluginHost's Diagnostic Capabilities
 * for svelte-check, without the overhead of the lsp.
 */
export class SvelteCheck {
    private docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text),
    );
    private configManager = new LSConfigManager();
    private pluginHost = new PluginHost(this.docManager, this.configManager);

    constructor(workspacePath: string) {
        Logger.setLogErrorsOnly(true);
        this.initialize(workspacePath);
    }

    private initialize(workspacePath: string) {
        this.pluginHost.register(new SveltePlugin(this.configManager, {}));
        this.pluginHost.register(new HTMLPlugin(this.docManager, this.configManager));
        this.pluginHost.register(new CSSPlugin(this.docManager, this.configManager));
        this.pluginHost.register(
            new TypeScriptPlugin(this.docManager, this.configManager, workspacePath),
        );
    }

    /**
     * Gets diagnostics for a svelte file.
     *
     * @param params Text and Uri of a svelte file
     */
    async getDiagnostics(params: { text: string; uri: string }): Promise<Diagnostic[]> {
        this.docManager.openDocument({
            languageId: 'svelte',
            text: params.text,
            uri: params.uri,
            version: 1,
        });
        return await this.pluginHost.getDiagnostics({ uri: params.uri });
    }
}
