import ts from 'typescript';
import { Document, DocumentManager } from '../../lib/documents';
import { LSConfigManager } from '../../ls-config';
import { debounceSameArg, pathToUrl } from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import {
    getService,
    getServiceForTsconfig,
    hasServiceForFile,
    LanguageServiceContainer,
    LanguageServiceDocumentContext
} from './service';
import { SnapshotManager } from './SnapshotManager';

export class LSAndTSDocResolver {
    /**
     *
     * @param docManager
     * @param workspaceUris
     * @param configManager
     * @param tsconfigPath This should only be set via svelte-check. Makes sure all documents are resolved to that tsconfig. Has to be absolute.
     */
    constructor(
        private readonly docManager: DocumentManager,
        private readonly workspaceUris: string[],
        private readonly configManager: LSConfigManager,
        private readonly tsconfigPath?: string
    ) {
        const handleDocumentChange = (document: Document) => {
            // This refreshes the document in the ts language service
            this.getSnapshot(document);
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
            transformOnTemplateError: !this.tsconfigPath
        };
    }

    async getLSForPath(path: string) {
        return (await this.getTSService(path)).getService();
    }

    async getLSAndTSDoc(document: Document): Promise<{
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
    }> {
        const lang = await this.getLSForPath(document.getFilePath() || '');
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
        if (!hasServiceForFile(filePath, this.workspaceUris)) {
            // Don't initialize a service for a file that should be deleted
            return;
        }

        (await this.getTSService(filePath)).deleteSnapshot(filePath);
        this.docManager.releaseDocument(pathToUrl(filePath));
    }

    /**
     * @internal Public for tests only
     */
    async getSnapshotManager(filePath: string): Promise<SnapshotManager> {
        return (await this.getTSService(filePath)).snapshotManager;
    }

    async getTSService(filePath?: string): Promise<LanguageServiceContainer> {
        if (this.tsconfigPath) {
            return getServiceForTsconfig(this.tsconfigPath, this.lsDocumentContext);
        }
        if (!filePath) {
            throw new Error('Cannot call getTSService without filePath and without tsconfigPath');
        }
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
