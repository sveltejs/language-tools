import ts from 'typescript';
import { Document, DocumentManager } from '../../lib/documents';
import { debounceSameArg, pathToUrl } from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import { getLanguageServiceForDocument, getLanguageServiceForPath, getService } from './service';
import { SnapshotManager } from './SnapshotManager';
import { findTsConfigPath } from './utils';

export class LSAndTSDocResolver {
    constructor(private readonly docManager: DocumentManager) {
        docManager.on(
            'documentChange',
            debounceSameArg(
                async (document: Document) => {
                    // This refreshes the document in the ts language service
                    this.getLSAndTSDoc(document);
                },
                (newDoc, prevDoc) => newDoc.uri === prevDoc?.uri,
                1000,
            ),
        );
    }

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

    getLSForPath(path: string) {
        return getLanguageServiceForPath(path, this.createDocument);
    }

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

    updateSnapshotPath(oldPath: string, newPath: string): DocumentSnapshot {
        this.deleteSnapshot(oldPath);
        return this.getSnapshot(newPath);
    }

    deleteSnapshot(filePath: string) {
        getService(filePath, this.createDocument).deleteDocument(filePath);
        this.docManager.releaseDocument(pathToUrl(filePath));
    }

    getSnapshotManager(fileName: string): SnapshotManager {
        const tsconfigPath = findTsConfigPath(fileName);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsconfigPath);
        return snapshotManager;
    }
}
