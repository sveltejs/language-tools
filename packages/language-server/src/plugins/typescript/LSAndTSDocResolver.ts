import { dirname } from 'path';
import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../lib/documents';
import { LSConfigManager } from '../../ls-config';
import {
    createGetCanonicalFileName,
    debounceSameArg,
    GetCanonicalFileName,
    normalizePath,
    pathToUrl,
    urlToPath
} from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import {
    getService,
    getServiceForTsconfig,
    forAllServices,
    LanguageServiceContainer,
    LanguageServiceDocumentContext
} from './service';
import { GlobalSnapshotsManager, SnapshotManager } from './SnapshotManager';
import { isSubPath } from './utils';

interface LSAndTSDocResolverOptions {
    notifyExceedSizeLimit?: () => void;
    /**
     * True, if used in the context of svelte-check
     */
    isSvelteCheck?: boolean;

    /**
     * This should only be set via svelte-check. Makes sure all documents are resolved to that tsconfig. Has to be absolute.
     */
    tsconfigPath?: string;

    onProjectReloaded?: () => void;
    watch?: boolean;
    tsSystem?: ts.System;
}

export class LSAndTSDocResolver {
    constructor(
        private readonly docManager: DocumentManager,
        private readonly workspaceUris: string[],
        private readonly configManager: LSConfigManager,
        private readonly options?: LSAndTSDocResolverOptions
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
        docManager.on('documentOpen', (document) => {
            handleDocumentChange(document);
            docManager.lockDocument(document.uri);
        });

        this.getCanonicalFileName = createGetCanonicalFileName(
            (options?.tsSystem ?? ts.sys).useCaseSensitiveFileNames
        );
    }

    /**
     * Create a svelte document -> should only be invoked with svelte files.
     */
    private createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument(
            {
                text: content,
                uri
            },
            /* openedByClient */ false
        );
        this.docManager.lockDocument(uri);
        return document;
    };

    private globalSnapshotsManager = new GlobalSnapshotsManager(
        this.lsDocumentContext.tsSystem,
        /* watchPackageJson */ !!this.options?.watch
    );
    private extendedConfigCache = new Map<string, ts.ExtendedConfigCacheEntry>();
    private getCanonicalFileName: GetCanonicalFileName;

    private get lsDocumentContext(): LanguageServiceDocumentContext {
        return {
            ambientTypesSource: this.options?.isSvelteCheck ? 'svelte-check' : 'svelte2tsx',
            createDocument: this.createDocument,
            transformOnTemplateError: !this.options?.isSvelteCheck,
            globalSnapshotsManager: this.globalSnapshotsManager,
            notifyExceedSizeLimit: this.options?.notifyExceedSizeLimit,
            extendedConfigCache: this.extendedConfigCache,
            onProjectReloaded: this.options?.onProjectReloaded,
            watchTsConfig: !!this.options?.watch,
            tsSystem: this.options?.tsSystem ?? ts.sys
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
        const { tsDoc, lsContainer, userPreferences } = await this.getLSAndTSDocWorker(document);

        return { tsDoc, lang: lsContainer.getService(), userPreferences };
    }

    /**
     * Retrieves the LS for operations that don't need cross-files information.
     * can save some time by not synchronizing languageService program
     */
    async getLsForSyntheticOperations(document: Document): Promise<{
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
    }> {
        const { tsDoc, lsContainer, userPreferences } = await this.getLSAndTSDocWorker(document);

        return { tsDoc, userPreferences, lang: lsContainer.getService(/* skipSynchronize */ true) };
    }

    private async getLSAndTSDocWorker(document: Document) {
        const lsContainer = await this.getTSService(document.getFilePath() || '');
        const tsDoc = await this.getSnapshot(document);
        const userPreferences = this.getUserPreferences(tsDoc);

        return { tsDoc, lsContainer, userPreferences };
    }

    /**
     * Retrieves and updates the snapshot for the given document or path from
     * the ts service it primarily belongs into.
     * The update is mirrored in all other services, too.
     */
    async getSnapshot(document: Document): Promise<SvelteDocumentSnapshot>;
    async getSnapshot(pathOrDoc: string | Document): Promise<DocumentSnapshot>;
    async getSnapshot(pathOrDoc: string | Document) {
        const filePath = typeof pathOrDoc === 'string' ? pathOrDoc : pathOrDoc.getFilePath() || '';
        const tsService = await this.getTSService(filePath);
        return tsService.updateSnapshot(pathOrDoc);
    }

    /**
     * Updates snapshot path in all existing ts services and retrieves snapshot
     */
    async updateSnapshotPath(oldPath: string, newPath: string): Promise<void> {
        for (const snapshot of this.globalSnapshotsManager.getByPrefix(oldPath)) {
            await this.deleteSnapshot(snapshot.filePath);
        }
        // This may not be a file but a directory, still try
        await this.getSnapshot(newPath);
    }

    /**
     * Deletes snapshot in all existing ts services
     */
    async deleteSnapshot(filePath: string) {
        await forAllServices((service) => service.deleteSnapshot(filePath));
        const uri = pathToUrl(filePath);
        if (this.docManager.get(uri)) {
            // Guard this call, due to race conditions it may already have been closed;
            // also this may not be a Svelte file
            this.docManager.closeDocument(uri);
        }
        this.docManager.releaseDocument(uri);
    }

    async invalidateModuleCache(filePath: string) {
        await forAllServices((service) => service.invalidateModuleCache(filePath));
    }

    /**
     * Updates project files in all existing ts services
     */
    async updateProjectFiles() {
        await forAllServices((service) => service.updateProjectFiles());
    }

    /**
     * Updates file in all ts services where it exists
     */
    async updateExistingTsOrJsFile(
        path: string,
        changes?: TextDocumentContentChangeEvent[]
    ): Promise<void> {
        path = normalizePath(path);
        // Only update once because all snapshots are shared between
        // services. Since we don't have a current version of TS/JS
        // files, the operation wouldn't be idempotent.
        let didUpdate = false;
        await forAllServices((service) => {
            if (service.hasFile(path) && !didUpdate) {
                didUpdate = true;
                service.updateTsOrJsFile(path, changes);
            }
        });
    }

    /**
     * @internal Public for tests only
     */
    async getSnapshotManager(filePath: string): Promise<SnapshotManager> {
        return (await this.getTSService(filePath)).snapshotManager;
    }

    async getTSService(filePath?: string): Promise<LanguageServiceContainer> {
        if (this.options?.tsconfigPath) {
            return getServiceForTsconfig(
                this.options?.tsconfigPath,
                dirname(this.options.tsconfigPath),
                this.lsDocumentContext
            );
        }
        if (!filePath) {
            throw new Error('Cannot call getTSService without filePath and without tsconfigPath');
        }
        return getService(filePath, this.workspaceUris, this.lsDocumentContext);
    }

    private getUserPreferences(tsDoc: DocumentSnapshot): ts.UserPreferences {
        const configLang =
            tsDoc.scriptKind === ts.ScriptKind.TS || tsDoc.scriptKind === ts.ScriptKind.TSX
                ? 'typescript'
                : 'javascript';

        const nearestWorkspaceUri = this.workspaceUris.find((workspaceUri) =>
            isSubPath(workspaceUri, tsDoc.filePath, this.getCanonicalFileName)
        );

        return this.configManager.getTsUserPreferences(
            configLang,
            nearestWorkspaceUri ? urlToPath(nearestWorkspaceUri) : null
        );
    }
}
