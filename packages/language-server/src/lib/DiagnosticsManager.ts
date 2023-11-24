import {
    Connection,
    TextDocumentIdentifier,
    Diagnostic,
    CancellationTokenSource,
    CancellationToken
} from 'vscode-languageserver';
import { DocumentManager, Document } from './documents';
import { debounceThrottle } from '../utils';

export type SendDiagnostics = Connection['sendDiagnostics'];
export type GetDiagnostics = (
    doc: TextDocumentIdentifier,
    cancellationToken?: CancellationToken
) => Thenable<Diagnostic[]>;

export class DiagnosticsManager {
    constructor(
        private sendDiagnostics: SendDiagnostics,
        private docManager: DocumentManager,
        private getDiagnostics: GetDiagnostics
    ) {}

    private pendingUpdates = new Set<Document>();
    private cancellationTokens = new Map<string, { cancel: () => void }>();

    private updateAll() {
        this.docManager.getAllOpenedByClient().forEach((doc) => {
            this.update(doc[1]);
        });
        this.pendingUpdates.clear();
    }

    scheduleUpdateAll() {
        this.cancellationTokens.forEach((token) => token.cancel());
        this.cancellationTokens.clear();
        this.pendingUpdates.clear();
        this.debouncedUpdateAll();
    }

    private debouncedUpdateAll = debounceThrottle(() => this.updateAll(), 1000);

    private async update(document: Document) {
        const uri = document.getURL();
        this.cancelStarted(uri);

        const tokenSource = new CancellationTokenSource();
        this.cancellationTokens.set(uri, tokenSource);

        const diagnostics = await this.getDiagnostics(
            { uri: document.getURL() },
            tokenSource.token
        );
        this.sendDiagnostics({
            uri: document.getURL(),
            diagnostics
        });

        tokenSource.dispose();

        if (this.cancellationTokens.get(uri) === tokenSource) {
            this.cancellationTokens.delete(uri);
        }
    }

    cancelStarted(uri: string) {
        const started = this.cancellationTokens.get(uri);
        if (started) {
            started.cancel();
        }
    }

    removeDiagnostics(document: Document) {
        this.pendingUpdates.delete(document);
        this.sendDiagnostics({
            uri: document.getURL(),
            diagnostics: []
        });
    }

    scheduleUpdate(document: Document) {
        if (!this.docManager.isOpenedInClient(document.getURL())) {
            return;
        }

        this.cancelStarted(document.getURL());
        this.pendingUpdates.add(document);
        this.scheduleBatchUpdate();
    }

    private scheduleBatchUpdate = debounceThrottle(() => {
        this.pendingUpdates.forEach((doc) => {
            this.update(doc);
        });
        this.pendingUpdates.clear();
    }, 700);
}
