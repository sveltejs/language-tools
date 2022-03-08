import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager, Configuration } from './config-manager';
import { SvelteSnapshotManager } from './svelte-snapshots';
import { getConfigPathForProject, isSvelteFilePath } from './utils';

export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}

export class ProjectSvelteFilesManager {
    private files: Set<string> | undefined;
    private directoryWatchers: Set<ts.FileWatcher> | undefined;

    private static instances = new Map<string, ProjectSvelteFilesManager>();

    static getInstance(projectName: string) {
        return this.instances.get(projectName);
    }

    constructor(
        private readonly typescript: typeof ts,
        private readonly project: ts.server.Project,
        private readonly serverHost: ts.server.ServerHost,
        private readonly snapshotManager: SvelteSnapshotManager,
        private parsedCommandLine: ts.ParsedCommandLine,
        configManager: ConfigManager
    ) {
        if (configManager.getConfig().enable) {
            this.setupWatchers();
        }

        configManager.onConfigurationChanged(this.onConfigChanged.bind(this));
        this.updateProjectSvelteFiles();
        ProjectSvelteFilesManager.instances.set(project.getProjectName(), this);
    }

    updateProjectConfig(serviceHost: ts.LanguageServiceHost) {
        const parsedCommandLine = serviceHost.getParsedCommandLine?.(
            getConfigPathForProject(this.project)
        );

        if (!parsedCommandLine) {
            return;
        }

        this.parsedCommandLine = parsedCommandLine;
        this.updateProjectSvelteFiles();
        this.disposeWatcher();
        this.setupWatchers();
    }

    getFiles() {
        return this.files ? Array.from(this.files) : [];
    }

    /**
     * Create directory watcher for include and exclude
     * The watcher in tsserver doesn't support svelte file
     * It won't add new created svelte file to root
     */
    private setupWatchers() {
        if (!this.directoryWatchers) {
            this.directoryWatchers = new Set();
        }

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

        this.updateProjectSvelteFiles();
    }

    private updateProjectSvelteFiles() {
        const fileNamesAfter = this.readProjectSvelteFilesFromFs();
        const filesBefore = this.files;
        const newFiles = filesBefore
            ? fileNamesAfter.filter((fileName) => !filesBefore.has(fileName))
            : fileNamesAfter;

        if (!this.files) {
            this.files = new Set();
        }

        for (const newFile of newFiles) {
            this.addFileToProject(newFile);
            this.files?.add(newFile);
        }
    }

    private addFileToProject(newFile: string) {
        this.snapshotManager.create(newFile);
        const snapshot = this.project.projectService.getScriptInfo(newFile);

        if (snapshot) {
            this.project.addRoot(snapshot);
        }
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

    private onConfigChanged(config: Configuration) {
        if (config.enable) {
            if (!this.directoryWatchers) {
                this.setupWatchers();
            }

            this.updateProjectSvelteFiles();
        } else {
            this.disposeWatcher();

            this.files?.forEach((file) => this.removeFileFromProject(file));
            this.files = undefined;
        }
    }

    private removeFileFromProject(file: string) {
        const info = this.project.getScriptInfo(file);

        if (info) {
            this.project.removeFile(info, true, true);
        }
    }

    private disposeWatcher() {
        if (!this.directoryWatchers) {
            return;
        }

        this.directoryWatchers.forEach((watcher) => watcher.close());
        this.directoryWatchers = undefined;
    }

    dispose() {
        this.disposeWatcher();

        ProjectSvelteFilesManager.instances.delete(this.project.getProjectName());
    }
}
