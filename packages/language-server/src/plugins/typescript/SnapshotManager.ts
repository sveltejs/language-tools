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
    private readonly documents: FileMap<DocumentSnapshot>;
    private lastLogged = new Date(new Date().getTime() - 60_001);

    private readonly projectFileToOriginalCasing: Map<string, string>;
    private getCanonicalFileName: GetCanonicalFileName;
    private watchingCanonicalDirectories: Map<string, ts.WatchDirectoryFlags> | undefined;

    private readonly watchExtensions = [
        ts.Extension.Dts,
        ts.Extension.Dcts,
        ts.Extension.Dmts,
        ts.Extension.Js,
        ts.Extension.Cjs,
        ts.Extension.Mjs,
        ts.Extension.Jsx,
        ts.Extension.Ts,
        ts.Extension.Mts,
        ts.Extension.Cts,
        ts.Extension.Tsx,
        ts.Extension.Json,
        '.svelte'
    ];

    constructor(
        private globalSnapshotsManager: GlobalSnapshotsManager,
        private fileSpec: TsFilesSpec,
        private workspaceRoot: string,
        private tsSystem: ts.System,
        projectFiles: string[],
        wildcardDirectories: ts.MapLike<ts.WatchDirectoryFlags> | undefined
    ) {
        this.onSnapshotChange = this.onSnapshotChange.bind(this);
        this.globalSnapshotsManager.onChange(this.onSnapshotChange);
        this.documents = new FileMap(tsSystem.useCaseSensitiveFileNames);
        this.projectFileToOriginalCasing = new Map();
        this.getCanonicalFileName = createGetCanonicalFileName(tsSystem.useCaseSensitiveFileNames);

        projectFiles.forEach((originalCasing) =>
            this.projectFileToOriginalCasing.set(
                this.getCanonicalFileName(originalCasing),
                originalCasing
            )
        );

        this.watchingCanonicalDirectories = new Map(
            Object.entries(wildcardDirectories ?? {}).map(([dir, flags]) => [
                this.getCanonicalFileName(dir),
                flags
            ])
        );
    }

    private onSnapshotChange(fileName: string, document: DocumentSnapshot | undefined) {
        // Only delete/update snapshots, don't add new ones,
        // as they could be from another TS service and this
        // snapshot manager can't reach this file.
        // For these, instead wait on a `get` method invocation
        // and set them "manually" in the set/update methods.
        if (!document) {
            this.documents.delete(fileName);
            this.projectFileToOriginalCasing.delete(this.getCanonicalFileName(fileName));
        } else if (this.documents.has(fileName)) {
            this.documents.set(fileName, document);
        }
    }

    areIgnoredFromNewFileWatch(watcherNewFiles: string[]): boolean {
        const { include } = this.fileSpec;

        // Since we default to not include anything,
        //  just don't waste time on this
        if (include?.length === 0 || !this.watchingCanonicalDirectories) {
            return true;
        }

        for (const newFile of watcherNewFiles) {
            const path = this.getCanonicalFileName(normalizePath(newFile));
            if (this.projectFileToOriginalCasing.has(path)) {
                continue;
            }

            for (const [dir, flags] of this.watchingCanonicalDirectories) {
                if (path.startsWith(dir)) {
                    if (!(flags & ts.WatchDirectoryFlags.Recursive)) {
                        const relative = path.slice(dir.length);
                        if (relative.includes('/')) {
                            continue;
                        }
                    }
                    return false;
                }
            }
        }

        return true;
    }

    updateProjectFiles(): void {
        const { include, exclude } = this.fileSpec;

        if (include?.length === 0) {
            return;
        }

        const projectFiles = this.tsSystem
            .readDirectory(this.workspaceRoot, this.watchExtensions, exclude, include)
            .map(normalizePath);

        projectFiles.forEach((projectFile) =>
            this.projectFileToOriginalCasing.set(
                this.getCanonicalFileName(projectFile),
                projectFile
            )
        );
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
        return (
            this.projectFileToOriginalCasing.has(this.getCanonicalFileName(fileName)) ||
            this.documents.has(fileName)
        );
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

    getClientFileNames(): string[] {
        return Array.from(this.documents.values())
            .filter((doc) => doc.isOpenedInClient())
            .map((doc) => doc.filePath);
    }

    getProjectFileNames(): string[] {
        return Array.from(this.projectFileToOriginalCasing.values());
    }

    isProjectFile(fileName: string): boolean {
        fileName = normalizePath(fileName);
        return this.projectFileToOriginalCasing.has(this.getCanonicalFileName(fileName));
    }

    private logStatistics() {
        const date = new Date();
        // Don't use setInterval because that will keep tests running forever
        if (date.getTime() - this.lastLogged.getTime() > 60_000) {
            this.lastLogged = date;

            const allFiles = Array.from(
                new Set([...this.projectFileToOriginalCasing.keys(), ...this.documents.keys()])
            );
            Logger.log(
                'SnapshotManager File Statistics:\n' +
                    `Project files: ${this.projectFileToOriginalCasing.size}\n` +
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
