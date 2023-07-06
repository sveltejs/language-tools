import ts from 'typescript';
import { DocumentSnapshot, JSOrTSDocumentSnapshot } from './DocumentSnapshot';
import { Logger } from '../../logger';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { createGetCanonicalFileName, GetCanonicalFileName, normalizePath } from '../../utils';
import { EventEmitter } from 'events';
import { FileMap } from '../../lib/documents/fileCollection';
import { dirname } from 'path';

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
    private packageJsonCache: PackageJsonCache;

    constructor(private readonly tsSystem: ts.System, watchPackageJson = false) {
        this.documents = new FileMap(tsSystem.useCaseSensitiveFileNames);
        this.getCanonicalFileName = createGetCanonicalFileName(tsSystem.useCaseSensitiveFileNames);
        this.packageJsonCache = new PackageJsonCache(
            tsSystem,
            watchPackageJson,
            this.getCanonicalFileName,
            this.updateSnapshotsInDirectory.bind(this)
        );
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

    getPackageJson(path: string) {
        return this.packageJsonCache.getPackageJson(path);
    }

    private updateSnapshotsInDirectory(dir: string) {
        this.getByPrefix(dir).forEach((snapshot) => {
            this.updateTsOrJsFile(snapshot.filePath);
        });
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
        private fileSpec: TsFilesSpec,
        private workspaceRoot: string,
        projectFiles: string[],
        useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames
    ) {
        this.onSnapshotChange = this.onSnapshotChange.bind(this);
        this.globalSnapshotsManager.onChange(this.onSnapshotChange);
        this.documents = new FileMap(useCaseSensitiveFileNames);
        this.projectFileToOriginalCasing = new Map();
        this.getCanonicalFileName = createGetCanonicalFileName(useCaseSensitiveFileNames);

        projectFiles.forEach((originalCasing) =>
            this.projectFileToOriginalCasing.set(
                this.getCanonicalFileName(originalCasing),
                originalCasing
            )
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

    getFileNames(): string[] {
        return Array.from(this.documents.entries()).map(([_, doc]) => doc.filePath);
    }

    getProjectFileNames(): string[] {
        return Array.from(this.projectFileToOriginalCasing.values());
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

class PackageJsonCache {
    constructor(
        private readonly tsSystem: ts.System,
        private readonly watchPackageJson: boolean,
        private readonly getCanonicalFileName: GetCanonicalFileName,
        private readonly updateSnapshotsInDirectory: (directory: string) => void
    ) {
        this.watchers = new FileMap(tsSystem.useCaseSensitiveFileNames);
    }

    private readonly watchers: FileMap<ts.FileWatcher>;

    private packageJsonCache = new FileMap<
        { text: string; modifiedTime: number | undefined } | undefined
    >();

    getPackageJson(path: string) {
        if (!this.packageJsonCache.has(path)) {
            this.packageJsonCache.set(path, this.initWatcherAndRead(path));
        }

        return this.packageJsonCache.get(path);
    }

    private initWatcherAndRead(path: string) {
        if (this.watchPackageJson) {
            this.tsSystem.watchFile?.(path, this.onPackageJsonWatchChange.bind(this), 3_000);
        }
        const exist = this.tsSystem.fileExists(path);

        if (!exist) {
            return undefined;
        }

        return this.readPackageJson(path);
    }

    private readPackageJson(path: string) {
        return {
            text: this.tsSystem.readFile(path) ?? '',
            modifiedTime: this.tsSystem.getModifiedTime?.(path)?.valueOf()
        };
    }

    private onPackageJsonWatchChange(path: string, onWatchChange: ts.FileWatcherEventKind) {
        const dir = dirname(path);

        if (onWatchChange === ts.FileWatcherEventKind.Deleted) {
            this.packageJsonCache.delete(path);
            this.watchers.get(path)?.close();
            this.watchers.delete(path);
        } else {
            this.packageJsonCache.set(path, this.readPackageJson(path));
        }

        if (!path.includes('node_modules')) {
            return;
        }

        setTimeout(() => {
            this.updateSnapshotsInDirectory(dir);
            const realPath =
                this.tsSystem.realpath &&
                this.getCanonicalFileName(normalizePath(this.tsSystem.realpath?.(dir)));

            // pnpm
            if (realPath && realPath !== dir) {
                this.updateSnapshotsInDirectory(realPath);
            }
        }, 500);
    }
}
