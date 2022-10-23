import ts from 'typescript';
import { DocumentSnapshot, JSOrTSDocumentSnapshot } from './DocumentSnapshot';
import { Logger } from '../../logger';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { createGetCanonicalFileName, GetCanonicalFileName, normalizePath } from '../../utils';
import { EventEmitter } from 'events';
import { FileMap } from '../../lib/documents/fileCollection';

type SnapshotChangeHandler = (fileName: string, newDocument: DocumentSnapshot | undefined) => void;

/**
 * Every snapshot corresponds to a unique file on disk.
 * A snapshot can be part of multiple projects, but for a given file path
 * there can be only one snapshot.
 */
export class GlobalSnapshotsManager {
    private emitter = new EventEmitter();
    private documents: FileMap<DocumentSnapshot>;
    private getCanonicalFileName: GetCanonicalFileName;

    constructor(private readonly tsSystem: ts.System) {
        this.documents = new FileMap(tsSystem.useCaseSensitiveFileNames);
        this.getCanonicalFileName = createGetCanonicalFileName(tsSystem.useCaseSensitiveFileNames);
    }

    get(fileName: string) {
        fileName = normalizePath(fileName);
        return this.documents.get(fileName);
    }

    getByPrefix(path: string) {
        path = this.getCanonicalFileName(normalizePath(path));
        return Array.from(this.documents.entries())
            .filter((doc) => doc[0].startsWith(path))
            .map((doc) => doc[1]);
    }

    set(fileName: string, document: DocumentSnapshot) {
        fileName = normalizePath(fileName);
        this.documents.set(fileName, document);
        this.emitter.emit('change', fileName, document);
    }

    delete(fileName: string) {
        fileName = normalizePath(fileName);
        this.documents.delete(fileName);
        this.emitter.emit('change', fileName, undefined);
    }

    updateTsOrJsFile(
        fileName: string,
        changes?: TextDocumentContentChangeEvent[]
    ): JSOrTSDocumentSnapshot | undefined {
        fileName = normalizePath(fileName);
        const previousSnapshot = this.get(fileName);

        if (changes) {
            if (!(previousSnapshot instanceof JSOrTSDocumentSnapshot)) {
                return;
            }
            previousSnapshot.update(changes);
            this.emitter.emit('change', fileName, previousSnapshot);
            return previousSnapshot;
        } else {
            const newSnapshot = DocumentSnapshot.fromNonSvelteFilePath(fileName, this.tsSystem);

            if (previousSnapshot) {
                newSnapshot.version = previousSnapshot.version + 1;
            } else {
                // ensure it's greater than initial version
                // so that ts server picks up the change
                newSnapshot.version += 1;
            }
            this.set(fileName, newSnapshot);
            return newSnapshot;
        }
    }

    onChange(listener: SnapshotChangeHandler) {
        this.emitter.on('change', listener);
    }

    removeChangeListener(listener: SnapshotChangeHandler) {
        this.emitter.off('change', listener);
    }
}

export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}

/**
 * Should only be used by `service.ts`
 */
export class SnapshotManager {
    private documents: FileMap<DocumentSnapshot>;
    private lastLogged = new Date(new Date().getTime() - 60_001);

    private readonly watchExtensions = [
        ts.Extension.Dts,
        ts.Extension.Js,
        ts.Extension.Jsx,
        ts.Extension.Ts,
        ts.Extension.Tsx,
        ts.Extension.Json
    ];

    constructor(
        private globalSnapshotsManager: GlobalSnapshotsManager,
        private projectFiles: string[],
        private fileSpec: TsFilesSpec,
        private workspaceRoot: string,
        useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames
    ) {
        this.onSnapshotChange = this.onSnapshotChange.bind(this);
        this.globalSnapshotsManager.onChange(this.onSnapshotChange);
        this.documents = new FileMap<DocumentSnapshot>(useCaseSensitiveFileNames);
    }

    private onSnapshotChange(fileName: string, document: DocumentSnapshot | undefined) {
        // Only delete/update snapshots, don't add new ones,
        // as they could be from another TS service and this
        // snapshot manager can't reach this file.
        // For these, instead wait on a `get` method invocation
        // and set them "manually" in the set/update methods.
        if (!document) {
            this.documents.delete(fileName);
            this.projectFiles = this.projectFiles.filter((s) => s !== fileName);
        } else if (this.documents.has(fileName)) {
            this.documents.set(fileName, document);
        }
    }

    updateProjectFiles(): void {
        const { include, exclude } = this.fileSpec;

        // Since we default to not include anything,
        //  just don't waste time on this
        if (include?.length === 0) {
            return;
        }

        const projectFiles = ts.sys
            .readDirectory(this.workspaceRoot, this.watchExtensions, exclude, include)
            .map(normalizePath);

        this.projectFiles = Array.from(new Set([...this.projectFiles, ...projectFiles]));
    }

    updateTsOrJsFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void {
        const snapshot = this.globalSnapshotsManager.updateTsOrJsFile(fileName, changes);
        // This isn't duplicated logic to the listener, because this could
        // be a new snapshot which the listener wouldn't add.
        if (snapshot) {
            this.documents.set(normalizePath(fileName), snapshot);
        }
    }

    has(fileName: string): boolean {
        fileName = normalizePath(fileName);
        return this.projectFiles.includes(fileName) || this.documents.has(fileName);
    }

    set(fileName: string, snapshot: DocumentSnapshot): void {
        this.globalSnapshotsManager.set(fileName, snapshot);
        // This isn't duplicated logic to the listener, because this could
        // be a new snapshot which the listener wouldn't add.
        this.documents.set(normalizePath(fileName), snapshot);
        this.logStatistics();
    }

    get(fileName: string): DocumentSnapshot | undefined {
        fileName = normalizePath(fileName);
        let snapshot = this.documents.get(fileName);
        if (!snapshot) {
            snapshot = this.globalSnapshotsManager.get(fileName);
            if (snapshot) {
                this.documents.set(fileName, snapshot);
            }
        }
        return snapshot;
    }

    delete(fileName: string): void {
        fileName = normalizePath(fileName);
        this.globalSnapshotsManager.delete(fileName);
    }

    getFileNames(): string[] {
        return Array.from(this.documents.entries()).map(([_, doc]) => doc.filePath);
    }

    getProjectFileNames(): string[] {
        return [...this.projectFiles];
    }

    private logStatistics() {
        const date = new Date();
        // Don't use setInterval because that will keep tests running forever
        if (date.getTime() - this.lastLogged.getTime() > 60_000) {
            this.lastLogged = date;

            const projectFiles = this.getProjectFileNames();
            const getCanonicalFileName = createGetCanonicalFileName(
                ts.sys.useCaseSensitiveFileNames
            );
            const allFiles = Array.from(
                new Set([...projectFiles, ...this.getFileNames()].map(getCanonicalFileName))
            );
            Logger.log(
                'SnapshotManager File Statistics:\n' +
                    `Project files: ${projectFiles.length}\n` +
                    `Svelte files: ${
                        allFiles.filter((name) => name.endsWith('.svelte')).length
                    }\n` +
                    `From node_modules: ${
                        allFiles.filter((name) => name.includes('node_modules')).length
                    }\n` +
                    `Total: ${allFiles.length}`
            );
        }
    }

    dispose() {
        this.globalSnapshotsManager.removeChangeListener(this.onSnapshotChange);
    }
}

export const ignoredBuildDirectories = ['__sapper__', '.svelte-kit'];
