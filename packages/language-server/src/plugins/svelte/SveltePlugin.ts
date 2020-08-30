import {
    CodeAction,
    CodeActionContext,
    CompletionList,
    Diagnostic,
    Hover,
    Position,
    Range,
    TextEdit,
    WorkspaceEdit,
} from 'vscode-languageserver';
import { Document } from '../../lib/documents';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import { importPrettier } from '../../importPackage';
import {
    CodeActionsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
} from '../interfaces';
import { executeCommand, getCodeActions } from './features/getCodeActions';
import { getCompletions } from './features/getCompletions';
import { getDiagnostics } from './features/getDiagnostics';
import { getHoverInfo } from './features/getHoverInfo';
import { SvelteCompileResult, SvelteDocument } from './SvelteDocument';
import { Logger } from '../../logger';

export class SveltePlugin
    implements
        DiagnosticsProvider,
        FormattingProvider,
        CompletionsProvider,
        HoverProvider,
        CodeActionsProvider {
    private docManager = new Map<Document, SvelteDocument>();

    constructor(private configManager: LSConfigManager, private prettierConfig: any) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        return getDiagnostics(
            document,
            await this.getSvelteDoc(document),
            this.configManager.getConfig().svelte.compilerWarnings,
        );
    }

    async getCompiledResult(document: Document): Promise<SvelteCompileResult | null> {
        try {
            const svelteDoc = await this.getSvelteDoc(document);
            return svelteDoc.getCompiledWith({ generate: 'dom' });
        } catch (error) {
            return null;
        }
    }

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (!this.featureEnabled('format')) {
            return [];
        }

        const filePath = document.getFilePath()!;
        const prettier = importPrettier(filePath);
        // Try resolving the config through prettier and fall back to possible editor config
        const config =
            (await prettier.resolveConfig(filePath, { editorconfig: true })) || this.prettierConfig;
        // Take .prettierignore into account
        const fileInfo = await prettier.getFileInfo(filePath, {ignorePath: this.prettierConfig?.ignorePath})
        if (fileInfo.ignored) {
            Logger.log('File is ignored, formatting skipped');
            return [];
        }

        const formattedCode = prettier.format(document.getText(), {
            ...config,
            plugins: getSveltePlugin(),
            parser: 'svelte' as any,
        });

        return [
            TextEdit.replace(
                Range.create(document.positionAt(0), document.positionAt(document.getTextLength())),
                formattedCode,
            ),
        ];

        function getSveltePlugin() {
            // Only provide our version of the svelte plugin if the user doesn't have one in
            // the workspace already. If we did it, Prettier would - for some reason - use
            // the workspace version for parsing and the extension version for printing,
            // which could crash if the contract of the parser output changed.
            const hasPluginLoadedAlready = prettier
                .getSupportInfo()
                .languages.some((l) => l.name === 'svelte');
            return hasPluginLoadedAlready ? [] : [require.resolve('prettier-plugin-svelte')];
        }
    }

    async getCompletions(document: Document, position: Position): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        return getCompletions(await this.getSvelteDoc(document), position);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(await this.getSvelteDoc(document), position);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        const svelteDoc = await this.getSvelteDoc(document);
        try {
            return getCodeActions(svelteDoc, range, context);
        } catch (error) {
            return [];
        }
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[],
    ): Promise<WorkspaceEdit | string | null> {
        if (!this.featureEnabled('codeActions')) {
            return null;
        }

        const svelteDoc = await this.getSvelteDoc(document);
        try {
            return executeCommand(svelteDoc, command, args);
        } catch (error) {
            return null;
        }
    }

    private featureEnabled(feature: keyof LSSvelteConfig) {
        return (
            this.configManager.enabled('svelte.enable') &&
            this.configManager.enabled(`svelte.${feature}.enable`)
        );
    }

    private async getSvelteDoc(document: Document) {
        let svelteDoc = this.docManager.get(document);
        if (!svelteDoc || svelteDoc.version !== document.version) {
            svelteDoc?.destroyTranspiled();
            svelteDoc = new SvelteDocument(document);
            this.docManager.set(document, svelteDoc);
        }
        return svelteDoc;
    }
}
