import { DocumentManager, Document } from '../../lib/documents';
import { pathToUrl } from '../../utils';
import { getLanguageServiceForDocument } from './service';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import { findTsConfigPath } from './utils';
import { SnapshotManager } from './SnapshotManager';
import ts from 'typescript';

export class LSAndTSDocResolver {
    constructor(private readonly docManager: DocumentManager) {}

    /**
     * Create a svelte document -> should only be invoked with svelte files.
     */
    private createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument({
            languageId: 'svelte',
            text: content,
            uri,
            version: 0,
        });
        this.docManager.lockDocument(uri);
        return document;
    };

    getLSAndTSDoc(
        document: Document,
    ): {
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
    } {
        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const filePath = document.getFilePath()!;
        const tsDoc = this.getSnapshot(filePath, document);

        return { tsDoc, lang };
    }

    getSnapshot(filePath: string, document: Document): SvelteDocumentSnapshot;
    getSnapshot(filePath: string, document?: Document): DocumentSnapshot;
    getSnapshot(filePath: string, document?: Document) {
        const snapshotManager = this.getSnapshotManager(filePath);

        let tsDoc = snapshotManager.get(filePath);
        if (!tsDoc) {
            tsDoc = document
                ? DocumentSnapshot.fromDocument(document)
                : DocumentSnapshot.fromFilePath(filePath);
            snapshotManager.set(filePath, tsDoc);
        }

        return tsDoc;
    }

    getSnapshotManager(fileName: string): SnapshotManager {
        const tsconfigPath = findTsConfigPath(fileName);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsconfigPath);
        return snapshotManager;
    }
}
