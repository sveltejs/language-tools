import { LanguageClient } from 'vscode-languageclient/node';
import { debounce } from 'lodash';
import {
    Uri,
    TextDocumentContentProvider,
    EventEmitter,
    workspace,
    window,
    Disposable
} from 'vscode';

type CompiledCodeResponse = {
    js: { code: string; map: any };
    css: { code: string; map: any };
};

// ContentProvider for "svelte-compiled://" files
export default class CompiledCodeContentProvider implements TextDocumentContentProvider {
    static previewWindowUri = Uri.parse('svelte-compiled:///preview.js');
    static scheme = 'svelte-compiled';

    private didChangeEmitter = new EventEmitter<Uri>();
    private selectedSvelteFile: string | undefined;
    private subscriptions: Disposable[] = [];
    private disposed = false;

    get onDidChange() {
        return this.didChangeEmitter.event;
    }

    // This function triggers a refresh of the preview window's content
    // by emitting an event to the didChangeEmitter. VSCode listens to
    // this.onDidChange and will call provideTextDocumentContent
    private refresh() {
        this.didChangeEmitter.fire(CompiledCodeContentProvider.previewWindowUri);
    }

    constructor(private getLanguageClient: () => LanguageClient) {
        this.subscriptions.push(
            // This event triggers a refresh of the preview window's content
            // whenever the selected svelte file's content changes
            // (debounced to prevent too many recompilations)
            workspace.onDidChangeTextDocument(
                debounce(async (event) => {
                    if (event.document.languageId == 'svelte' && this.selectedSvelteFile) {
                        this.refresh();
                    }
                }, 500)
            )
        );

        this.subscriptions.push(
            // This event sets the selectedSvelteFile when there is a different svelte file selected
            // and triggers a refresh of the preview window's content
            window.onDidChangeActiveTextEditor((editor) => {
                if (editor?.document?.languageId !== 'svelte') {
                    return;
                }

                const newFile = editor.document.uri.toString();

                if (newFile !== this.selectedSvelteFile) {
                    this.selectedSvelteFile = newFile;
                    this.refresh();
                }
            })
        );
    }

    // This is called when VSCode needs to get the content of the preview window
    // we can trigger this using the didChangeEmitter
    async provideTextDocumentContent(): Promise<string | undefined> {
        // If there is no selected svelte file, try to get it from the activeTextEditor
        // This should only happen when the svelte.showCompiledCodeToSide command is called the first time
        if (!this.selectedSvelteFile && window.activeTextEditor) {
            this.selectedSvelteFile = window.activeTextEditor.document.uri.toString();
        }

        // Should not be possible but handle it anyway
        if (!this.selectedSvelteFile) {
            window.setStatusBarMessage('Svelte: no svelte file selected');
            return;
        }

        const response = await this.getLanguageClient().sendRequest<CompiledCodeResponse>(
            '$/getCompiledCode',
            this.selectedSvelteFile
        );

        const path = this.selectedSvelteFile.replace('file://', '');

        if (response?.js?.code) {
            return `/* Compiled: ${path} */\n${response.js.code}`;
        } else {
            window.setStatusBarMessage(`Svelte: fail to compile ${path}`, 3000);
        }
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.subscriptions.forEach((d) => d.dispose());
        this.subscriptions.length = 0;
        this.disposed = true;
    }
}
