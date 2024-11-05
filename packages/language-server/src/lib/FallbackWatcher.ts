import { FSWatcher, watch } from 'chokidar';
import { debounce } from 'lodash';
import { join } from 'path';
import {
    DidChangeWatchedFilesParams,
    FileChangeType,
    FileEvent,
    RelativePattern
} from 'vscode-languageserver';
import { pathToUrl } from '../utils';
import { fileURLToPath } from 'url';
import { Stats } from 'fs';

type DidChangeHandler = (para: DidChangeWatchedFilesParams) => void;

const DELAY = 50;

export class FallbackWatcher {
    private readonly watcher: FSWatcher;
    private readonly callbacks: DidChangeHandler[] = [];

    private undeliveredFileEvents: FileEvent[] = [];

    constructor(watchExtensions: string[], workspacePaths: string[]) {
        const gitOrNodeModules = /\.git|node_modules/;
        const ignoredExtensions = (fileName: string, stats?: Stats) => {
            return (
                stats?.isFile() === true && !watchExtensions.some((ext) => fileName.endsWith(ext))
            );
        };
        this.watcher = watch(workspacePaths, {
            ignored: [gitOrNodeModules, ignoredExtensions],
            // typescript would scan the project files on init.
            // We only need to know what got updated.
            ignoreInitial: true,
            ignorePermissionErrors: true
        });

        this.watcher
            .on('add', (path) => this.onFSEvent(path, FileChangeType.Created))
            .on('unlink', (path) => this.onFSEvent(path, FileChangeType.Deleted))
            .on('change', (path) => this.onFSEvent(path, FileChangeType.Changed));
    }

    private convert(path: string, type: FileChangeType): FileEvent {
        return {
            type,
            uri: pathToUrl(path)
        };
    }

    private onFSEvent(path: string, type: FileChangeType) {
        const fileEvent = this.convert(path, type);

        this.undeliveredFileEvents.push(fileEvent);
        this.scheduleTrigger();
    }

    private readonly scheduleTrigger = debounce(() => {
        const para: DidChangeWatchedFilesParams = {
            changes: this.undeliveredFileEvents
        };
        this.undeliveredFileEvents = [];

        this.callbacks.forEach((callback) => callback(para));
    }, DELAY);

    onDidChangeWatchedFiles(callback: DidChangeHandler) {
        this.callbacks.push(callback);
    }

    watchDirectory(patterns: RelativePattern[]) {
        for (const pattern of patterns) {
            const basePath = fileURLToPath(
                typeof pattern.baseUri === 'string' ? pattern.baseUri : pattern.baseUri.uri
            );
            if (!basePath) {
                continue;
            }
            this.watcher.add(join(basePath, pattern.pattern));
        }
    }

    dispose() {
        this.watcher.close();
    }
}
