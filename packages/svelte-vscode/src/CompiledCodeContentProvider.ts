import { LanguageClient } from 'vscode-languageclient';
import {
    Uri,
    TextDocumentContentProvider,
    EventEmitter,
    workspace,
    window,
    Disposable,
} from 'vscode';
import { atob, btoa } from './utils';
import { debounce } from 'lodash';

const SVELTE_URI_SCHEME = 'svelte-compiled';

function toSvelteSchemeUri<B extends boolean = false>(
    srcUri: string | Uri,
    asString?: B,
): B extends true ? string : Uri {
    srcUri = typeof srcUri == 'string' ? Uri.parse(srcUri) : srcUri;
    const src = btoa(srcUri.toString());
    const destUri = srcUri.with({
        scheme: SVELTE_URI_SCHEME,
        fragment: src,
        path: srcUri.path + '.js',
    });
    return (asString ? destUri.toString() : destUri) as any;
}

function fromSvelteSchemeUri<B extends boolean = false>(
    destUri: string | Uri,
    asString?: B,
): B extends true ? string : Uri {
    destUri = typeof destUri == 'string' ? Uri.parse(destUri) : destUri;
    const src = atob(destUri.fragment);
    return (asString ? src : Uri.parse(src)) as any;
}

export default class CompiledCodeContentProvider implements TextDocumentContentProvider {
    static scheme = SVELTE_URI_SCHEME;
    static toSvelteSchemeUri = toSvelteSchemeUri;
    static fromSvelteSchemeUri = fromSvelteSchemeUri;

    private _onDidChange = new EventEmitter<Uri>();
    private _subscriptions: Disposable[] = [];
    private _watchedSourceUri = new Set<string>();

    get onDidChange() {
        return this._onDidChange.event;
    }

    constructor(private getLanguageClient: () => LanguageClient) {
        this._subscriptions.push(
            workspace.onDidChangeTextDocument(
                debounce(async (changeEvent) => {
                    if (changeEvent.document.languageId !== 'svelte') return;
                    const srcUri = changeEvent.document.uri.toString();
                    if (this._watchedSourceUri.has(srcUri)) {
                        console.log('debounced change event', srcUri);
                        this._onDidChange.fire(toSvelteSchemeUri(srcUri));
                    }
                }, 500),
            ),
        ),
            window.onDidChangeVisibleTextEditors((editors) => {
                const previewEditors = editors.filter(
                    (editor) => editor?.document?.uri?.scheme === SVELTE_URI_SCHEME,
                );
                this._watchedSourceUri = new Set(
                    previewEditors.map((editor) => fromSvelteSchemeUri(editor.document.uri, true)),
                );
            });
    }

    async provideTextDocumentContent(uri: Uri): Promise<string | undefined> {
        const srcUriStr = fromSvelteSchemeUri(uri, true);
        this._watchedSourceUri.add(srcUriStr);

        const resp = await this.getLanguageClient().sendRequest<CompiledCodeResp>(
            '$/getCompiledCode',
            srcUriStr,
        );
        if (resp?.js?.code) {
            return resp.js.code;
        } else {
            window.setStatusBarMessage(`Svelte: fail to compile ${uri.path}`, 3000);
            // window.showWarningMessage(`Svelte: fail to compile ${uri.path}`);
        }
    }

    private _disposed = false;

    dispose() {
        if (this._disposed) return;
        this._onDidChange.dispose();
        this._subscriptions.forEach((d) => d.dispose());
        this._subscriptions.length = 0;
        delete this.getLanguageClient;
        this._disposed = true;
    }
}

type CompiledCodeResp = {
    js: { code: string; map: any };
    css: { code: string; map: any };
};
