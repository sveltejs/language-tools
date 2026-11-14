import { FSWatcher as ChokidarWatcher, watch as chokidarWatch } from 'chokidar';
import { existsSync, FSWatcher, Stats, watch } from 'fs';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import {
    DidChangeWatchedFilesParams,
    FileChangeType,
    FileEvent,
    RelativePattern
} from 'vscode-languageserver';
import { Logger } from '../logger';
import { debounce, pathToUrl } from '../utils';
import { fileURLToPath } from 'url';

type DidChangeHandler = (para: DidChangeWatchedFilesParams) => void;
type FileEventHandler = (path: string, type: FileChangeType) => void;

interface WatcherBackend {
    add(path: string, recursive: boolean): void;
    close(): void;
}

const DELAY = 50;
const gitOrNodeModules = /\.git|node_modules/;

// On macOS one recursive fs.watch uses a single FSEvents stream for a whole tree, so large
// workspaces can't exhaust the per-process watch limit the way one handle per directory does.
const supportsNativeRecursiveWatch = process.platform === 'darwin';

export class FallbackWatcher {
    private readonly backend: WatcherBackend;
    private readonly callbacks: DidChangeHandler[] = [];

    private undeliveredFileEvents: FileEvent[] = [];

    constructor(watchExtensions: string[], workspacePaths: string[]) {
        const onFileEvent: FileEventHandler = (path, type) => this.onFSEvent(path, type);
        this.backend = supportsNativeRecursiveWatch
            ? new NativeRecursiveBackend(watchExtensions, onFileEvent)
            : new ChokidarBackend(watchExtensions, onFileEvent);

        for (const path of workspacePaths) {
            this.backend.add(path, true);
        }
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
            this.backend.add(basePath, pattern.pattern.startsWith('**/'));
        }
    }

    dispose() {
        this.backend.close();
    }
}

class ChokidarBackend implements WatcherBackend {
    private readonly watcher: ChokidarWatcher;

    constructor(watchExtensions: string[], onFileEvent: FileEventHandler) {
        const ignoredExtensions = (fileName: string, stats?: Stats) => {
            return (
                stats?.isFile() === true && !watchExtensions.some((ext) => fileName.endsWith(ext))
            );
        };
        this.watcher = chokidarWatch([], {
            ignored: [gitOrNodeModules, ignoredExtensions],
            // typescript would scan the project files on init.
            // We only need to know what got updated.
            ignoreInitial: true,
            ignorePermissionErrors: true
        });

        this.watcher
            .on('add', (path) => onFileEvent(path, FileChangeType.Created))
            .on('unlink', (path) => onFileEvent(path, FileChangeType.Deleted))
            .on('change', (path) => onFileEvent(path, FileChangeType.Changed));
    }

    add(path: string) {
        this.watcher.add(path);
    }

    close() {
        void this.watcher.close();
    }
}

/**
 * fs.watch reports every change as a 'rename' on macOS, so whether a file was created
 * or changed is decided by remembering which files exist, like chokidar does.
 */
class NativeRecursiveBackend implements WatcherBackend {
    private readonly watchers: FSWatcher[] = [];
    private readonly knownFiles = new Set<string>();

    constructor(
        private readonly watchExtensions: string[],
        private readonly onFileEvent: FileEventHandler
    ) {}

    add(path: string, recursive: boolean) {
        try {
            const watcher = watch(path, { recursive }, (_, fileName) => {
                if (fileName) {
                    this.onChange(path, fileName.toString());
                }
            });
            watcher.on('error', (error) => Logger.error('File watcher error:', error));
            this.watchers.push(watcher);
        } catch (error) {
            Logger.error(`Failed to watch ${path}:`, error);
            return;
        }
        void this.collectKnownFiles(path, path, recursive);
    }

    close() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers.length = 0;
    }

    private isWatched(relativePath: string) {
        return (
            !gitOrNodeModules.test(relativePath) &&
            this.watchExtensions.some((ext) => relativePath.endsWith(ext))
        );
    }

    private onChange(basePath: string, relativePath: string) {
        if (!this.isWatched(relativePath)) {
            return;
        }
        const path = join(basePath, relativePath);
        if (!existsSync(path)) {
            this.knownFiles.delete(path);
            this.onFileEvent(path, FileChangeType.Deleted);
            return;
        }
        const type = this.knownFiles.has(path) ? FileChangeType.Changed : FileChangeType.Created;
        this.knownFiles.add(path);
        this.onFileEvent(path, type);
    }

    private async collectKnownFiles(basePath: string, dir: string, recursive: boolean) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            const relativePath = relative(basePath, path);
            if (entry.isDirectory()) {
                if (recursive && !gitOrNodeModules.test(relativePath)) {
                    await this.collectKnownFiles(basePath, path, recursive);
                }
            } else if (entry.isFile() && this.isWatched(relativePath)) {
                this.knownFiles.add(path);
            }
        }
    }
}
