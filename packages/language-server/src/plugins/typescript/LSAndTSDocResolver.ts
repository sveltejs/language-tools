import ts from 'typescript';
import { Document, DocumentManager } from '../../lib/documents';
import { LSConfigManager } from '../../ls-config';
import { debounceSameArg, pathToUrl } from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import {
    getLanguageServiceForDocument,
    getLanguageServiceForPath,
    getService,
    LanguageServiceContainer
} from './service';
import { SnapshotManager } from './SnapshotManager';

export class LSAndTSDocResolver {
    constructor(
        private readonly docManager: DocumentManager,
        private readonly workspaceUris: string[],
        private readonly configManager: LSConfigManager
    ) {
        docManager.on(
            'documentChange',
            debounceSameArg(
                async (document: Document) => {
                    // This refreshes the document in the ts language service
                    this.getLSAndTSDoc(document);
                },
                (newDoc, prevDoc) => newDoc.uri === prevDoc?.uri,
                1000
            )
        );
    }

    /**
     * Create a svelte document -> should only be invoked with svelte files.
     */
    private createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument({
            text: content,
            uri
        });
        this.docManager.lockDocument(uri);
        return document;
    };

    getLSForPath(path: string) {
        return getLanguageServiceForPath(path, this.workspaceUris, this.createDocument);
    }

    getLSAndTSDoc(
        document: Document
    ): {
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
    } {
        const lang = getLanguageServiceForDocument(
            document,
            this.workspaceUris,
            this.createDocument
        );
        const filePath = document.getFilePath()!;
        const tsDoc = this.getSnapshot(filePath, document);
        const userPreferences = this.getUserPreferences(tsDoc.scriptKind);

        return { tsDoc, lang, userPreferences };
    }

    getSnapshot(filePath: string, document: Document): SvelteDocumentSnapshot;
    getSnapshot(filePath: string, document?: Document): DocumentSnapshot;
    getSnapshot(filePath: string, document?: Document) {
        const tsService = this.getTSService(filePath);
        const { snapshotManager } = tsService;

        let tsDoc = snapshotManager.get(filePath);
        if (!tsDoc) {
            const options = { strictMode: !!tsService.compilerOptions.strict };
            tsDoc = document
                ? DocumentSnapshot.fromDocument(document, options)
                : DocumentSnapshot.fromFilePath(filePath, options);
            snapshotManager.set(filePath, tsDoc);
        }

        return tsDoc;
    }

    updateSnapshotPath(oldPath: string, newPath: string): DocumentSnapshot {
        this.deleteSnapshot(oldPath);
        return this.getSnapshot(newPath);
    }

    deleteSnapshot(filePath: string) {
        this.getTSService(filePath).deleteDocument(filePath);
        this.docManager.releaseDocument(pathToUrl(filePath));
    }

    getSnapshotManager(filePath: string): SnapshotManager {
        return this.getTSService(filePath).snapshotManager;
    }

    private getTSService(filePath: string): LanguageServiceContainer {
        return getService(filePath, this.workspaceUris, this.createDocument);
    }

    private getUserPreferences(scriptKind: ts.ScriptKind): ts.UserPreferences {
        const configLang =
            scriptKind === ts.ScriptKind.TS || scriptKind === ts.ScriptKind.TSX
                ? 'typescript'
                : 'javascript';

        return this.configManager.getTsUserPreferences(configLang);
    }
}
