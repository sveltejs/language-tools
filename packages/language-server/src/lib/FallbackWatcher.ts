import { FSWatcher, watch } from 'chokidar';
import { join } from 'path';
import { DidChangeWatchedFilesParams, FileChangeType, FileEvent } from 'vscode-languageserver';
import { pathToUrl } from '../utils';

type DidChangeHandler = (para: DidChangeWatchedFilesParams) => void;

export class FallbackWatcher {
    private readonly watcher: FSWatcher;
    private readonly callbacks: DidChangeHandler[] = [];

    constructor(glob: string, workspacePaths: string[]) {
        const gitOrNodeModules = /\.git|node_modules/;
        this.watcher = watch(
            workspacePaths.map((workspacePath) => join(workspacePath, glob)),
            {
                ignored: (path: string) =>
                    gitOrNodeModules.test(path) &&
                    // Handle Sapper's alias mapping
                    !path.includes('src/node_modules') &&
                    !path.includes('src\\node_modules'),

                // typescript would scan the project files on init.
                // We only need to know what got updated.
                ignoreInitial: true,
                ignorePermissionErrors: true
            }
        );

        this.watcher
            .on('add', (path) => this.callback(path, FileChangeType.Created))
            .on('unlink', (path) => this.callback(path, FileChangeType.Deleted))
            .on('change', (path) => this.callback(path, FileChangeType.Changed));
    }

    private convert(path: string, type: FileChangeType): DidChangeWatchedFilesParams {
        const event: FileEvent = {
            type,
            uri: pathToUrl(path)
        };

        return {
            changes: [event]
        };
    }

    private callback(path: string, type: FileChangeType) {
        const para = this.convert(path, type);
        this.callbacks.forEach((callback) => callback(para));
    }

    onDidChangeWatchedFiles(callback: DidChangeHandler) {
        this.callbacks.push(callback);
    }

    dispose() {
        this.watcher.close();
    }
}
