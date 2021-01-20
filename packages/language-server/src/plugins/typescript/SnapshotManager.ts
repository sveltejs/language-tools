import ts from 'typescript';
import {
    DocumentSnapshot,
    JSOrTSDocumentSnapshot,
    SvelteSnapshotOptions
} from './DocumentSnapshot';
import { Logger } from '../../logger';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';

export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}

export class SnapshotManager {
    private documents: Map<string, DocumentSnapshot> = new Map();
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
        private projectFiles: string[],
        private fileSpec: TsFilesSpec,
        private workspaceRoot: string
    ) {}

    updateProjectFiles() {
        const { include, exclude } = this.fileSpec;

        // Since we default to not include anything,
        //  just don't waste time on this
        if (include?.length === 0) {
            return;
        }

        const projectFiles = ts.sys.readDirectory(
            this.workspaceRoot,
            this.watchExtensions,
            exclude,
            include
        );

        this.projectFiles = Array.from(new Set([...this.projectFiles, ...projectFiles]));
    }

    updateByFileName(fileName: string, options: SvelteSnapshotOptions) {
        if (!this.has(fileName)) {
            return;
        }

        const newSnapshot = DocumentSnapshot.fromFilePath(fileName, options);
        const previousSnapshot = this.get(fileName);

        if (previousSnapshot) {
            newSnapshot.version = previousSnapshot.version + 1;
        } else {
            // ensure it's greater than initial version
            // so that ts server picks up the change
            newSnapshot.version += 1;
        }

        this.set(fileName, newSnapshot);
    }

    updateTsOrJsFile(fileName: string, changes: TextDocumentContentChangeEvent[]): void {
        if (!this.has(fileName)) {
            return;
        }

        const previousSnapshot = this.get(fileName);
        if (!(previousSnapshot instanceof JSOrTSDocumentSnapshot)) {
            return;
        }

        previousSnapshot.update(changes);
    }

    has(fileName: string) {
        return this.projectFiles.includes(fileName) || this.getFileNames().includes(fileName);
    }

    set(fileName: string, snapshot: DocumentSnapshot) {
        const prev = this.get(fileName);
        if (prev) {
            prev.destroyFragment();
        }

        this.logStatistics();

        return this.documents.set(fileName, snapshot);
    }

    get(fileName: string) {
        return this.documents.get(fileName);
    }

    delete(fileName: string) {
        this.projectFiles = this.projectFiles.filter((s) => s !== fileName);
        return this.documents.delete(fileName);
    }

    getFileNames() {
        return Array.from(this.documents.keys());
    }

    getProjectFileNames() {
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
