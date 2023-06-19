import { _Connection, TextDocumentIdentifier, Diagnostic } from 'vscode-languageserver';
import { DocumentManager, Document } from './documents';
import { debounceThrottle } from '../utils';

export type SendDiagnostics = _Connection['sendDiagnostics'];
export type GetDiagnostics = (doc: TextDocumentIdentifier) => Thenable<Diagnostic[]>;

export class DiagnosticsManager {
    constructor(
        private sendDiagnostics: SendDiagnostics,
        private docManager: DocumentManager,
        private getDiagnostics: GetDiagnostics
    ) {}

    private pendingUpdates = new Set<Document>();

    private updateAll() {
        this.docManager.getAllOpenedByClient().forEach((doc) => {
            this.update(doc[1]);
        });
        this.pendingUpdates.clear();
    }

    scheduleUpdateAll = debounceThrottle(() => this.updateAll(), 1000);

    private async update(document: Document) {
        const diagnostics = await this.getDiagnostics({ uri: document.getURL() });
        this.sendDiagnostics({
            uri: document.getURL(),
            diagnostics
        });
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

        this.pendingUpdates.add(document);
        this.scheduleBatchUpdate();
    }

    private scheduleBatchUpdate = debounceThrottle(() => {
        this.pendingUpdates.forEach((doc) => {
            this.update(doc);
        });
        this.pendingUpdates.clear();
    }, 750);
}
