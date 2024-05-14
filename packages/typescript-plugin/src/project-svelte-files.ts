import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager, Configuration } from './config-manager';
import { SvelteSnapshotManager } from './svelte-snapshots';
import { getConfigPathForProject, isSvelteFilePath } from './utils';
import { Logger } from './logger';

export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}

export class ProjectSvelteFilesManager {
    private projectFileToOriginalCasing = new Map<string, string>();
    private directoryWatchers = new Set<ts.FileWatcher>();

    private static instances = new Map<string, ProjectSvelteFilesManager>();

    static getInstance(projectName: string) {
        return this.instances.get(projectName);
    }

    constructor(
        private readonly typescript: typeof ts,
        private readonly project: ts.server.Project,
        private readonly serverHost: ts.server.ServerHost,
        private readonly snapshotManager: SvelteSnapshotManager,
        private readonly logger: Logger,
        private parsedCommandLine: ts.ParsedCommandLine,
        private readonly configManager: ConfigManager
    ) {
        if (configManager.getConfig().enable) {
            this.setupWatchers();
            this.updateProjectSvelteFiles();
        }

        configManager.onConfigurationChanged(this.onConfigChanged);
        ProjectSvelteFilesManager.instances.set(project.getProjectName(), this);
    }

    updateProjectConfig(serviceHost: ts.LanguageServiceHost) {
        const parsedCommandLine = serviceHost.getParsedCommandLine?.(
            getConfigPathForProject(this.project)
        );

        if (!parsedCommandLine) {
            return;
        }

        this.disposeWatchers();
        this.clearProjectFile();
        this.parsedCommandLine = parsedCommandLine;
        this.setupWatchers();
        this.updateProjectSvelteFiles();
    }

    getFiles() {
        return Array.from(this.projectFileToOriginalCasing.values());
    }

    /**
     * Create directory watcher for include and exclude
     * The watcher in tsserver doesn't support svelte file
     * It won't add new created svelte file to root
     */
    private setupWatchers() {
        for (const directory in this.parsedCommandLine.wildcardDirectories) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    this.parsedCommandLine.wildcardDirectories,
                    directory
                )
            ) {
                continue;
            }

            const watchDirectoryFlags = this.parsedCommandLine.wildcardDirectories[directory];
            const watcher = this.serverHost.watchDirectory(
                directory,
                this.watcherCallback.bind(this),
                watchDirectoryFlags === this.typescript.WatchDirectoryFlags.Recursive,
                this.parsedCommandLine.watchOptions
            );

            this.directoryWatchers.add(watcher);
        }
    }

    private watcherCallback(fileName: string) {
        if (!isSvelteFilePath(fileName)) {
            return;
        }

        // We can't just add the file to the project directly, because
        // - the casing of fileName is different
        // - we don't know whether the file was added or deleted
        this.updateProjectSvelteFiles();
    }

    private updateProjectSvelteFiles() {
        const fileNamesAfter = this.readProjectSvelteFilesFromFs().map((file) => ({
            originalCasing: file,
            canonicalFileName: this.project.projectService.toCanonicalFileName(file)
        }));

        const removedFiles = new Set(this.projectFileToOriginalCasing.keys());
        const newFiles: typeof fileNamesAfter = [];

        for (const file of fileNamesAfter) {
            const existingFile = this.projectFileToOriginalCasing.get(file.canonicalFileName);
            if (!existingFile) {
                newFiles.push(file);
                continue;
            }

            removedFiles.delete(file.canonicalFileName);
            if (existingFile !== file.originalCasing) {
                this.projectFileToOriginalCasing.set(file.canonicalFileName, file.originalCasing);
            }
        }

        for (const newFile of newFiles) {
            this.addFileToProject(newFile.originalCasing);
            this.projectFileToOriginalCasing.set(newFile.canonicalFileName, newFile.originalCasing);
        }
        for (const removedFile of removedFiles) {
            this.removeFileFromProject(removedFile, false);
            this.projectFileToOriginalCasing.delete(removedFile);
        }
    }

    private addFileToProject(newFile: string) {
        this.snapshotManager.create(newFile);
        const snapshot = this.project.projectService.getScriptInfo(newFile);

        if (!snapshot) {
            return;
        }

        if (this.project.isRoot(snapshot)) {
            this.logger.debug(`File ${newFile} is already in root`);
            return;
        }

        this.project.addRoot(snapshot);
    }

    private readProjectSvelteFilesFromFs() {
        const fileSpec: TsFilesSpec = this.parsedCommandLine.raw;
        const { include, exclude } = fileSpec;

        if (include?.length === 0) {
            return [];
        }

        return this.typescript.sys
            .readDirectory(
                this.project.getCurrentDirectory() || process.cwd(),
                ['.svelte'],
                exclude,
                include
            )
            .map(this.typescript.server.toNormalizedPath);
    }

    private onConfigChanged = (config: Configuration) => {
        this.disposeWatchers();
        this.clearProjectFile();

        if (config.enable) {
            this.setupWatchers();
            this.updateProjectSvelteFiles();
        }
    };

    private removeFileFromProject(file: string, exists = true) {
        const info = this.project.getScriptInfo(file);

        if (info) {
            this.project.removeFile(info, exists, true);
        }
    }

    private disposeWatchers() {
        this.directoryWatchers.forEach((watcher) => watcher.close());
        this.directoryWatchers.clear();
    }

    private clearProjectFile() {
        this.projectFileToOriginalCasing.forEach((file) => this.removeFileFromProject(file));
        this.projectFileToOriginalCasing.clear();
    }

    dispose() {
        this.disposeWatchers();

        // Don't remove files from the project here
        // because TypeScript already does that when the project is closed
        // - and because the project is closed, `project.removeFile` will result in an error
        this.projectFileToOriginalCasing.clear();

        this.configManager.removeConfigurationChangeListener(this.onConfigChanged);

        ProjectSvelteFilesManager.instances.delete(this.project.getProjectName());
    }
}
