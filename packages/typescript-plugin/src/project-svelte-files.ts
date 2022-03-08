import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager } from './config-manager';
import { SvelteSnapshotManager } from './svelte-snapshots';
import { isSvelteFilePath } from './utils';

const projectSvelteFilesMap = new Map<string, string[]>();

export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}

export function updateProjectSvelteFiles(
    typescript: typeof ts,
    project: ts.server.Project,
    parsedCommandLine: ts.ParsedCommandLine
) {
    const files = readProjectSvelteFilesFromFs(typescript, project, parsedCommandLine.raw);

    projectSvelteFilesMap.set(project.getProjectName(), files);
}

function readProjectSvelteFilesFromFs(
    typescript: typeof ts,
    project: ts.server.Project,
    fileSpec: TsFilesSpec
) {
    const { include, exclude } = fileSpec;

    if (include?.length === 0) {
        return [];
    }

    return typescript.sys
        .readDirectory(
            project.getCurrentDirectory() || process.cwd(),
            ['.svelte'],
            exclude,
            include
        )
        .map(typescript.sys.resolvePath);
}

export function watchDirectoryForNewSvelteFiles(
    parsedCommandLine: ts.ParsedCommandLine | undefined,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    configManager: ConfigManager,
    snapshotManager: SvelteSnapshotManager
) {
    let watchers: ts.FileWatcher[] = [];
    let watcherCreated = false;

    if (configManager.getConfig().enable) {
        watchers = setupWatcher(parsedCommandLine, info, typescript, snapshotManager);

        watcherCreated = true;
    }

    configManager.onConfigurationChanged((config) => {
        if (config.enable) {
            if (!watcherCreated) {
                watchers = setupWatcher(parsedCommandLine, info, typescript, snapshotManager);
            }
        } else {
            dispose();
            watcherCreated = false;
        }
    });

    return {
        dispose
    };

    function dispose() {
        watchers.forEach((watcher) => watcher.close());
    }
}

function setupWatcher(
    parsedCommandLine: ts.ParsedCommandLine | undefined,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    snapshotManager: SvelteSnapshotManager
) {
    if (!parsedCommandLine?.wildcardDirectories) {
        return [];
    }

    const watchers: ts.FileWatcher[] = [];
    for (const directory in parsedCommandLine.wildcardDirectories) {
        if (
            !Object.prototype.hasOwnProperty.call(parsedCommandLine.wildcardDirectories, directory)
        ) {
            continue;
        }
        const watchDirectoryFlags = parsedCommandLine.wildcardDirectories[directory];

        const watcher = info.serverHost.watchDirectory(
            directory,
            (fileName) => {
                if (!isSvelteFilePath(fileName)) {
                    return;
                }

                const projectName = info.project.getProjectName();
                const fileNamesBefore = projectSvelteFilesMap.get(projectName);
                updateProjectSvelteFiles(typescript, info.project, parsedCommandLine);
                const fileNamesAfter = projectSvelteFilesMap.get(projectName);
                const newFiles =
                    (fileNamesBefore
                        ? fileNamesAfter?.filter((fileName) => !fileNamesBefore.includes(fileName))
                        : fileNamesAfter) ?? [];

                for (const newFile of newFiles) {
                    snapshotManager.create(newFile);
                    const snapshot = info.project.projectService.getScriptInfoForNormalizedPath(
                        typescript.server.toNormalizedPath(newFile)
                    );

                    if (snapshot) {
                        info.project.addRoot(snapshot);
                    }
                }

                info.project.markAsDirty();
            },
            watchDirectoryFlags === typescript.WatchDirectoryFlags.Recursive,
            parsedCommandLine.watchOptions
        );

        watchers.push(watcher);
    }

    return watchers;
}

export function getProjectSvelteFiles(project: ts.server.Project) {
    return projectSvelteFilesMap.get(project.getProjectName());
}
