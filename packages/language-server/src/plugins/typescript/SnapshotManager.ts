import { resolve, dirname } from 'path';
import ts from 'typescript';
import { DocumentSnapshot, SvelteSnapshotOptions } from './DocumentSnapshot';
import { Logger } from '../../logger';

export interface TsFilesSpec {
    include: readonly string[];
    exclude: readonly string[];
}

export class SnapshotManager {
    private documents: Map<string, DocumentSnapshot> = new Map();
    private lastLogged = new Date(new Date().getTime() - 60_001);

    constructor(
        private projectFiles: string[],
        fileSpec: TsFilesSpec,
        tsConfigPath: string,
    ) {
        this.fileSpec = this.resloveFileSpecs(fileSpec, tsConfigPath);
    }

    private readonly fileSpec: TsFilesSpec;

    private resloveFileSpecs(fileSpec: TsFilesSpec, tsConfigPath: string): TsFilesSpec {
        const basePath = dirname(tsConfigPath);
        const resolveToBase = (path: string) => resolve(basePath, path);

        return {
            exclude: fileSpec.exclude.map(resolveToBase),
            include: fileSpec.include.map(resolveToBase)
        };
    }
    updateProjectFilesByDirname(
        path: string,
        readDirCache: Map<string, string[]>) {
        let projectFilesInDir = readDirCache.get(path);

        if (!projectFilesInDir) {
            const { include, exclude } = this.fileSpec;

            projectFilesInDir = ts.sys.readDirectory(
                path,
                this.getExtensions(),
                include,
                exclude,
                undefined
            );

            readDirCache.set(path, projectFilesInDir);
            console.log(projectFilesInDir);
        }

        this.projectFiles = Array.from(new Set([...this.projectFiles, ...projectFilesInDir]));
    }

    private getExtensions() {
        return [
            ts.Extension.Dts,
            ts.Extension.Js,
            ts.Extension.Jsx,
            ts.Extension.Ts,
            ts.Extension.Tsx,
            ts.Extension.Json
        ];
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
                `SnapshotManager File Statistics:\n` +
                    `Project files: ${projectFiles.length}\n` +
                    `Svelte files: ${
                        allFiles.filter((name) => name.endsWith('.svelte')).length
                    }\n` +
                    `From node_modules: ${
                        allFiles.filter((name) => name.includes('node_modules')).length
                    }\n` +
                    `Total: ${allFiles.length}`,
            );
        }
    }
}
