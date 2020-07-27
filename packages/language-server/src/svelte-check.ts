import { Document, DocumentManager } from './lib/documents';
import { LSConfigManager } from './ls-config';
import { CSSPlugin, HTMLPlugin, PluginHost, SveltePlugin, TypeScriptPlugin } from './plugins';
import { Diagnostic } from 'vscode-languageserver';
import { Logger } from './logger';
import { urlToPath } from './utils';

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
     * Creates/updates given document
     *
     * @param doc Text and Uri of the document
     */
    upsertDocument(doc: { text: string; uri: string }) {
        this.docManager.openDocument({
            text: doc.text,
            uri: doc.uri,
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
        { filePath: string; text: string; diagnostics: Diagnostic[] }[]
    > {
        return await Promise.all(
            this.docManager.getAllOpenedByClient().map(async (doc) => {
                const uri = doc[1].uri;
                const diagnostics = await this.pluginHost.getDiagnostics({ uri });
                return {
                    filePath: urlToPath(uri) || '',
                    text: this.docManager.documents.get(uri)?.getText() || '',
                    diagnostics,
                };
            }),
        );
    }
}
