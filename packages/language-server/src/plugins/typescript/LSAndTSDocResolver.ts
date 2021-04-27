import ts from 'typescript';
import { Document, DocumentManager } from '../../lib/documents';
import { LSConfigManager } from '../../ls-config';
import { debounceSameArg, pathToUrl } from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import {
    getLanguageServiceForDocument,
    getLanguageServiceForPath,
    getService,
    LanguageServiceContainer,
    LanguageServiceDocumentContext
} from './service';
import { SnapshotManager } from './SnapshotManager';

export class LSAndTSDocResolver {
    constructor(
        private readonly docManager: DocumentManager,
        private readonly workspaceUris: string[],
        private readonly configManager: LSConfigManager,
        private readonly transformOnTemplateError = true
    ) {
        const handleDocumentChange = (document: Document) => {
            // This refreshes the document in the ts language service
            this.getLSAndTSDoc(document);
        };
        docManager.on(
            'documentChange',
            debounceSameArg(
                handleDocumentChange,
                (newDoc, prevDoc) => newDoc.uri === prevDoc?.uri,
                1000
            )
        );

        // New files would cause typescript to rebuild its type-checker.
        // Open it immediately to reduce rebuilds in the startup
        // where multiple files and their dependencies
        // being loaded in a short period of times
        docManager.on('documentOpen', handleDocumentChange);
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

    private get lsDocumentContext(): LanguageServiceDocumentContext {
        return {
            createDocument: this.createDocument,
            transformOnTemplateError: this.transformOnTemplateError
        };
    }

    async getLSForPath(path: string) {
        return getLanguageServiceForPath(path, this.workspaceUris, this.lsDocumentContext);
    }

    async getLSAndTSDoc(
        document: Document
    ): Promise<{
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
    }> {
        const lang = await getLanguageServiceForDocument(
            document,
            this.workspaceUris,
            this.lsDocumentContext
        );
        const tsDoc = await this.getSnapshot(document);
        const userPreferences = this.getUserPreferences(tsDoc.scriptKind);

        return { tsDoc, lang, userPreferences };
    }

    async getSnapshot(document: Document): Promise<SvelteDocumentSnapshot>;
    async getSnapshot(pathOrDoc: string | Document): Promise<DocumentSnapshot>;
    async getSnapshot(pathOrDoc: string | Document) {
        const filePath = typeof pathOrDoc === 'string' ? pathOrDoc : pathOrDoc.getFilePath() || '';
        const tsService = await this.getTSService(filePath);
        return tsService.updateSnapshot(pathOrDoc);
    }

    async updateSnapshotPath(oldPath: string, newPath: string): Promise<DocumentSnapshot> {
        await this.deleteSnapshot(oldPath);
        return this.getSnapshot(newPath);
    }

    async deleteSnapshot(filePath: string) {
        (await this.getTSService(filePath)).deleteSnapshot(filePath);
        this.docManager.releaseDocument(pathToUrl(filePath));
    }

    async getSnapshotManager(filePath: string): Promise<SnapshotManager> {
        return (await this.getTSService(filePath)).snapshotManager;
    }

    private getTSService(filePath: string): Promise<LanguageServiceContainer> {
        return getService(filePath, this.workspaceUris, this.lsDocumentContext);
    }

    private getUserPreferences(scriptKind: ts.ScriptKind): ts.UserPreferences {
        const configLang =
            scriptKind === ts.ScriptKind.TS || scriptKind === ts.ScriptKind.TSX
                ? 'typescript'
                : 'javascript';

        return this.configManager.getTsUserPreferences(configLang);
    }
}
