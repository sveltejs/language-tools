import { isAbsolute } from 'path';
import ts from 'typescript';
import { Diagnostic, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from './lib/documents';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import { CSSPlugin, PluginHost, SveltePlugin, TypeScriptPlugin } from './plugins';
import { convertRange, getDiagnosticTag, mapSeverity } from './plugins/typescript/utils';
import { pathToUrl, urlToPath } from './utils';

export type SvelteCheckDiagnosticSource = 'js' | 'css' | 'svelte';

export interface SvelteCheckOptions {
    compilerWarnings?: Record<string, 'ignore' | 'error'>;
    diagnosticSources?: SvelteCheckDiagnosticSource[];
    /**
     * Path has to be absolute
     */
    tsconfig?: string;
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
    private typeScriptPlugin?: TypeScriptPlugin;

    constructor(workspacePath: string, private options: SvelteCheckOptions = {}) {
        Logger.setLogErrorsOnly(true);
        this.initialize(workspacePath, options);
    }

    private async initialize(workspacePath: string, options: SvelteCheckOptions) {
        if (options.tsconfig && !isAbsolute(options.tsconfig)) {
            throw new Error('tsconfigPath needs to be absolute, got ' + options.tsconfig);
        }

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
        if (shouldRegister('js') || options.tsconfig) {
            this.typeScriptPlugin = new TypeScriptPlugin(
                this.docManager,
                this.configManager,
                [pathToUrl(workspacePath)],
                /**isEditor */ false
            );
            this.pluginHost.register(this.typeScriptPlugin);
        }

        function shouldRegister(source: SvelteCheckDiagnosticSource) {
            return !options.diagnosticSources || options.diagnosticSources.includes(source);
        }
    }

    /**
     * Creates/updates given document
     *
     * @param doc Text and Uri of the document
     * @param isNew Whether or not this is the creation of the document
     */
    async upsertDocument(doc: { text: string; uri: string }, isNew: boolean): Promise<void> {
        const filePath = urlToPath(doc.uri) || '';

        if (isNew && this.options.tsconfig) {
            const lsContainer = await this.getLSContainer(this.options.tsconfig);
            if (!lsContainer.fileBelongsToProject(filePath)) {
                return;
            }
        }

        if (doc.uri.endsWith('.ts') || doc.uri.endsWith('.js')) {
            this.pluginHost.updateTsOrJsFile(filePath, [
                {
                    range: Range.create(
                        Position.create(0, 0),
                        Position.create(Number.MAX_VALUE, Number.MAX_VALUE)
                    ),
                    text: doc.text
                }
            ]);
        } else {
            const document = this.docManager.openDocument({
                text: doc.text,
                uri: doc.uri
            });
            this.docManager.markAsOpenedInClient(doc.uri);
            if (this.options.tsconfig) {
                // TODO openDocument notifies the LsAndTsDocResolver which may add
                // the document to a different tsconfig. Therefore do this here one more time.
                // --> find a way to get rid of this workaround
                const lsContainer = await this.getLSContainer(this.options.tsconfig);
                lsContainer.updateSnapshot(document);
            }
        }
    }

    /**
     * Removes/closes document
     *
     * @param uri Uri of the document
     */
    async removeDocument(uri: string): Promise<void> {
        this.docManager.closeDocument(uri);
        this.docManager.releaseDocument(uri);
        if (this.options.tsconfig) {
            const lsContainer = await this.getLSContainer(this.options.tsconfig);
            lsContainer.deleteSnapshot(urlToPath(uri) || '');
        }
    }

    /**
     * Gets the diagnostics for all currently open files.
     */
    async getDiagnostics(): Promise<
        Array<{ filePath: string; text: string; diagnostics: Diagnostic[] }>
    > {
        if (this.options.tsconfig) {
            return this.getDiagnosticsForTsconfig(this.options.tsconfig);
        }
        return await Promise.all(
            this.docManager.getAllOpenedByClient().map(async (doc) => {
                const uri = doc[1].uri;
                return await this.getDiagnosticsForFile(uri);
            })
        );
    }

    private async getDiagnosticsForTsconfig(tsconfigPath: string) {
        const lsContainer = await this.getLSContainer(tsconfigPath);
        const lang = lsContainer.getService();
        const files = lang.getProgram()?.getSourceFiles() || [];

        return await Promise.all(
            files.map((file) => {
                const uri = pathToUrl(file.fileName);
                const doc = this.docManager.get(uri);
                if (doc) {
                    this.docManager.markAsOpenedInClient(uri);
                    return this.getDiagnosticsForFile(uri);
                } else {
                    const diagnostics = [
                        ...lang.getSyntacticDiagnostics(file.fileName),
                        ...lang.getSuggestionDiagnostics(file.fileName),
                        ...lang.getSemanticDiagnostics(file.fileName)
                    ].map<Diagnostic>((diagnostic) => ({
                        range: convertRange(
                            { positionAt: file.getLineAndCharacterOfPosition.bind(file) },
                            diagnostic
                        ),
                        severity: mapSeverity(diagnostic.category),
                        source: diagnostic.source,
                        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                        code: diagnostic.code,
                        tags: getDiagnosticTag(diagnostic)
                    }));
                    return {
                        filePath: file.fileName,
                        text: file.text,
                        diagnostics
                    };
                }
            })
        );
    }

    private async getDiagnosticsForFile(uri: string) {
        const diagnostics = await this.pluginHost.getDiagnostics({ uri });
        return {
            filePath: urlToPath(uri) || '',
            text: this.docManager.get(uri)?.getText() || '',
            diagnostics
        };
    }

    private getLSContainer(tsconfigPath: string) {
        if (!this.typeScriptPlugin) {
            throw new Error('Cannot run with tsconfig path without TypeScript plugin');
        }
        return this.typeScriptPlugin.getLSContainerForTsconfigPath(tsconfigPath);
    }
}
