import { FSWatcher, watch } from 'chokidar';
import { join } from 'path';
import { DidChangeWatchedFilesParams, FileChangeType, FileEvent } from 'vscode-languageserver';
import { pathToUrl } from '../utils';

type DidChangeHandler = (para: DidChangeWatchedFilesParams) => void;

export class FallbackWatcher {
    private readonly watcher: FSWatcher;
    private readonly callbacks: DidChangeHandler[] = [];

    constructor(glob: string, private readonly workspacePath: string) {
        this.watcher = watch(glob, {
            cwd: workspacePath
        });

        this.watcher.on('add', (path) => this.callback(path, FileChangeType.Created));
        this.watcher.on('unlink', (path) => this.callback(path, FileChangeType.Deleted));
        this.watcher.on('change', (path) => this.callback(path, FileChangeType.Changed));
    }

    private convert(relativePath: string, type: FileChangeType): DidChangeWatchedFilesParams {
        const path = join(this.workspacePath, relativePath);

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
