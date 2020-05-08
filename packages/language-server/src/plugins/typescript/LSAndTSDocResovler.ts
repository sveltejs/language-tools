import { DocumentManager, Document } from '../../lib/documents';
import { pathToUrl } from '../../utils';
import { getLanguageServiceForDocument } from './service';
import { DocumentSnapshot } from './DocumentSnapshot';
import { findTsConfigPath } from './utils';
import { SnapshotManager } from './SnapshotManager';

export class LSAndTSDocResovler {
    constructor(private readonly docManager: DocumentManager) {}

    createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument({
            languageId: '',
            text: content,
            uri,
            version: 0,
        });
        this.docManager.lockDocument(uri);
        return document;
    };

    getLSAndTSDoc(document: Document) {
        const lang = getLanguageServiceForDocument(document, this.createDocument);
        const filePath = document.getFilePath()!;
        const tsDoc = this.getSnapshot(filePath, document);

        return { tsDoc, lang };
    }

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

    getSnapshotManager(fileName: string) {
        const tsconfigPath = findTsConfigPath(fileName);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsconfigPath);
        return snapshotManager;
    }
}
