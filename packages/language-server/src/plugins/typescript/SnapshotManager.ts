import ts from 'typescript';
import { DocumentSnapshot, JSOrTSDocumentSnapshot } from './DocumentSnapshot';
import { Logger } from '../../logger';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { normalizePath } from '../../utils';
import { EventEmitter } from 'events';

/**
 * Every snapshot corresponds to a unique file on disk.
 * A snapshot can be part of multiple projects, but for a given file path
 * there can be only one snapshot.
 */
export class GlobalSnapshotsManager {
    private emitter = new EventEmitter();
    private documents = new Map<string, DocumentSnapshot>();

    get(fileName: string) {
        fileName = normalizePath(fileName);
        return this.documents.get(fileName);
    }

    set(fileName: string, document: DocumentSnapshot) {
        fileName = normalizePath(fileName);
        const prev = this.get(fileName);
        if (prev) {
            prev.destroyFragment();
        }

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
            const newSnapshot = DocumentSnapshot.fromNonSvelteFilePath(fileName);

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

    onChange(listener: (fileName: string, newDocument: DocumentSnapshot | undefined) => void) {
        this.emitter.on('change', listener);
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
    private documents = new Map<string, DocumentSnapshot>();
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
        private workspaceRoot: string
    ) {
        this.globalSnapshotsManager.onChange((fileName, document) => {
            // Only delete/update snapshots, don't add new ones,
            // as they could be from another TS service and this
            // snapshot manager can't reach this file.
            // For these, instead wait on a `get` method invocation
            // and set them "manually" in the set/update methods.
            if (!document) {
                this.documents.delete(fileName);
            } else if (this.documents.has(fileName)) {
                this.documents.set(fileName, document);
            }
        });
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
        return this.projectFiles.includes(fileName) || this.getFileNames().includes(fileName);
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
        this.projectFiles = this.projectFiles.filter((s) => s !== fileName);
        this.globalSnapshotsManager.delete(fileName);
    }

    getFileNames(): string[] {
        return Array.from(this.documents.keys());
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
            const allFiles = Array.from(new Set([...projectFiles, ...this.getFileNames()]));
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
}

export const ignoredBuildDirectories = ['__sapper__', '.svelte-kit'];
