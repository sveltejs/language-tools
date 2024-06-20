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

type DidChangeHandler = (para: DidChangeWatchedFilesParams) => void;

const DELAY = 50;

export class FallbackWatcher {
    private readonly watcher: FSWatcher;
    private readonly callbacks: DidChangeHandler[] = [];

    private undeliveredFileEvents: FileEvent[] = [];
    private readonly nonRecursivePatterns: string;

    constructor(nonRecursivePatterns: string, workspacePaths: string[]) {
        this.nonRecursivePatterns = nonRecursivePatterns;
        const gitOrNodeModules = /\.git|node_modules/;
        const recursivePatterns = '**/' + nonRecursivePatterns;
        this.watcher = watch(
            workspacePaths.map((workspacePath) => join(workspacePath, recursivePatterns)),
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
