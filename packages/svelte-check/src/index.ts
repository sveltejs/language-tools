/**
 * This code's groundwork is taken from https://github.com/vuejs/vetur/tree/master/vti
 */

import { watch, FSWatcher } from 'chokidar';
import * as fs from 'fs';
import { fdir } from 'fdir';
import * as path from 'path';
import { SvelteCheck, SvelteCheckOptions } from 'svelte-language-server';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { parseOptions, SvelteCheckCliOptions } from './options';
import {
    DEFAULT_FILTER,
    DiagnosticFilter,
    HumanFriendlyWriter,
    MachineFriendlyWriter,
    Writer
} from './writers';

type Result = {
    fileCount: number;
    errorCount: number;
    warningCount: number;
    fileCountWithProblems: number;
};

async function openAllDocuments(
    workspaceUri: URI,
    filePathsToIgnore: string[],
    svelteCheck: SvelteCheck
) {
    const offset = workspaceUri.fsPath.length + 1;
    // We support a very limited subset of glob patterns: You can only have  ** at the end or the start
    const ignored = createIgnored(filePathsToIgnore);
    const isIgnored = (path: string) => {
        path = path.slice(offset);
        for (const i of ignored) {
            if (i(path)) {
                return true;
            }
        }
        return false;
    };
    const absFilePaths = await new fdir()
        .filter((path) => path.endsWith('.svelte') && !isIgnored(path))
        .exclude((_, path) => {
            return path.includes('/node_modules/') || path.includes('/.');
        })
        .withPathSeparator('/')
        .withFullPaths()
        .crawl(workspaceUri.fsPath)
        .withPromise();

    for (const absFilePath of absFilePaths) {
        const text = fs.readFileSync(absFilePath, 'utf-8');
        svelteCheck.upsertDocument(
            {
                uri: URI.file(absFilePath).toString(),
                text
            },
            true
        );
    }
}

function createIgnored(filePathsToIgnore: string[]): Array<(path: string) => boolean> {
    return filePathsToIgnore.map((i) => {
        if (i.endsWith('**')) i = i.slice(0, -2);

        if (i.startsWith('**')) {
            i = i.slice(2);

            if (i.includes('*'))
                throw new Error(
                    'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
                );

            return (path) => path.includes(i);
        }

        if (i.includes('*'))
            throw new Error(
                'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
            );

        return (path) => path.startsWith(i);
    });
}

async function getDiagnostics(
    workspaceUri: URI,
    writer: Writer,
    svelteCheck: SvelteCheck
): Promise<Result | null> {
    writer.start(workspaceUri.fsPath);

    try {
        const diagnostics = await svelteCheck.getDiagnostics();

        const result: Result = {
            fileCount: diagnostics.length,
            errorCount: 0,
            warningCount: 0,
            fileCountWithProblems: 0
        };

        for (const diagnostic of diagnostics) {
            writer.file(
                diagnostic.diagnostics,
                workspaceUri.fsPath,
                path.relative(workspaceUri.fsPath, diagnostic.filePath),
                diagnostic.text
            );

            let fileHasProblems = false;

            diagnostic.diagnostics.forEach((d: Diagnostic) => {
                if (d.severity === DiagnosticSeverity.Error) {
                    result.errorCount += 1;
                    fileHasProblems = true;
                } else if (d.severity === DiagnosticSeverity.Warning) {
                    result.warningCount += 1;
                    fileHasProblems = true;
                }
            });

            if (fileHasProblems) {
                result.fileCountWithProblems += 1;
            }
        }

        writer.completion(
            result.fileCount,
            result.errorCount,
            result.warningCount,
            result.fileCountWithProblems
        );
        return result;
    } catch (err: any) {
        writer.failure(err);
        return null;
    }
}

const FILE_ENDING_REGEX = /\.(svelte|d\.ts|ts|js|jsx|tsx|mjs|cjs|mts|cts)$/;
const VITE_CONFIG_REGEX = /vite\.config\.(js|ts)\.timestamp-/;

class DiagnosticsWatcher {
    private updateDiagnostics: any;
    private watcher: FSWatcher;
    private currentWatchedDirs = new Set<string>();
    private userIgnored: Array<(path: string) => boolean>;
    private pendingWatcherUpdate: any;

    constructor(
        private workspaceUri: URI,
        private svelteCheck: SvelteCheck,
        private writer: Writer,
        filePathsToIgnore: string[],
        private ignoreInitialAdd: boolean
    ) {
        this.userIgnored = createIgnored(filePathsToIgnore);

        // Create watcher with initial paths
        this.watcher = watch([], {
            ignored: (path, stats) => {
                if (
                    path.includes('node_modules') ||
                    path.includes('.git') ||
                    (stats?.isFile() &&
                        (!FILE_ENDING_REGEX.test(path) || VITE_CONFIG_REGEX.test(path)))
                ) {
                    return true;
                }

                if (this.userIgnored.length !== 0) {
                    // Make path relative to workspace for user ignores
                    const workspaceRelative = path.startsWith(this.workspaceUri.fsPath)
                        ? path.slice(this.workspaceUri.fsPath.length + 1)
                        : path;
                    for (const i of this.userIgnored) {
                        if (i(workspaceRelative)) {
                            return true;
                        }
                    }
                }

                return false;
            },
            ignoreInitial: this.ignoreInitialAdd
        })
            .on('add', (path) => this.updateDocument(path, true))
            .on('unlink', (path) => this.removeDocument(path))
            .on('change', (path) => this.updateDocument(path, false));

        this.updateWatchedDirectories();
        if (this.ignoreInitialAdd) {
            getDiagnostics(this.workspaceUri, this.writer, this.svelteCheck);
        }
    }

    private isSubdir(candidate: string, parent: string) {
        const c = path.resolve(candidate);
        const p = path.resolve(parent);
        return c === p || c.startsWith(p + path.sep);
    }

    private minimizeDirs(dirs: string[]): string[] {
        const sorted = [...new Set(dirs.map((d) => path.resolve(d)))].sort();
        const result: string[] = [];
        for (const dir of sorted) {
            if (!result.some((p) => this.isSubdir(dir, p))) {
                result.push(dir);
            }
        }
        return result;
    }

    addWatchDirectory(dir: string) {
        if (!dir) return;
        // Skip if already covered by an existing watched directory
        for (const existing of this.currentWatchedDirs) {
            if (this.isSubdir(dir, existing)) {
                return;
            }
        }
        // If new dir is a parent of existing ones, unwatch children
        const toRemove: string[] = [];
        for (const existing of this.currentWatchedDirs) {
            if (this.isSubdir(existing, dir)) {
                toRemove.push(existing);
            }
        }
        if (toRemove.length) {
            this.watcher.unwatch(toRemove);
            for (const r of toRemove) this.currentWatchedDirs.delete(r);
        }
        this.watcher.add(dir);
        this.currentWatchedDirs.add(dir);
    }

    private async updateWatchedDirectories() {
        const watchDirs = await this.svelteCheck.getWatchDirectories();
        const desired = this.minimizeDirs(
            (watchDirs?.map((d) => d.path) || [this.workspaceUri.fsPath]).map((p) =>
                path.resolve(p)
            )
        );

        const current = new Set([...this.currentWatchedDirs].map((p) => path.resolve(p)));
        const desiredSet = new Set(desired);

        const toAdd = desired.filter((d) => !current.has(d));
        const toRemove = [...current].filter((d) => !desiredSet.has(d));

        if (toAdd.length) this.watcher.add(toAdd);
        if (toRemove.length) this.watcher.unwatch(toRemove);

        this.currentWatchedDirs = new Set(desired);
    }

    private async updateDocument(path: string, isNew: boolean) {
        await this.svelteCheck.upsertDocument(
            {
                // delay reading until we actually need the text
                // prevents race conditions from crashing svelte-check when something is created and deleted immediately afterwards
                get text() {
                    return fs.existsSync(path) ? fs.readFileSync(path, 'utf-8') : '';
                },
                uri: URI.file(path).toString()
            },
            isNew
        );
        this.scheduleDiagnostics();
    }

    private async removeDocument(path: string) {
        await this.svelteCheck.removeDocument(URI.file(path).toString());
        this.scheduleDiagnostics();
    }

    updateWatchers() {
        clearTimeout(this.pendingWatcherUpdate);
        this.pendingWatcherUpdate = setTimeout(() => this.updateWatchedDirectories(), 1000);
    }

    scheduleDiagnostics() {
        clearTimeout(this.updateDiagnostics);
        this.updateDiagnostics = setTimeout(
            () => getDiagnostics(this.workspaceUri, this.writer, this.svelteCheck),
            1000
        );
    }
}

function createFilter(opts: SvelteCheckCliOptions): DiagnosticFilter {
    switch (opts.threshold) {
        case 'error':
            return (d) => d.severity === DiagnosticSeverity.Error;
        case 'warning':
            return (d) =>
                d.severity === DiagnosticSeverity.Error ||
                d.severity === DiagnosticSeverity.Warning;
        default:
            return DEFAULT_FILTER;
    }
}

function instantiateWriter(opts: SvelteCheckCliOptions): Writer {
    const filter = createFilter(opts);

    if (opts.outputFormat === 'human-verbose' || opts.outputFormat === 'human') {
        return new HumanFriendlyWriter(
            process.stdout,
            opts.outputFormat === 'human-verbose',
            opts.watch,
            !opts.preserveWatchOutput,
            filter
        );
    } else {
        return new MachineFriendlyWriter(
            process.stdout,
            opts.outputFormat === 'machine-verbose',
            filter
        );
    }
}

parseOptions(async (opts) => {
    try {
        const writer = instantiateWriter(opts);

        const svelteCheckOptions: SvelteCheckOptions = {
            compilerWarnings: opts.compilerWarnings,
            diagnosticSources: opts.diagnosticSources,
            tsconfig: opts.tsconfig,
            watch: opts.watch
        };

        if (opts.watch) {
            // Wire callbacks that can reference the watcher instance created below
            let watcher: DiagnosticsWatcher;
            svelteCheckOptions.onProjectReload = () => {
                watcher.updateWatchers();
                watcher.scheduleDiagnostics();
            };
            svelteCheckOptions.onFileSnapshotCreated = (filePath: string) => {
                const dirPath = path.dirname(filePath);
                watcher.addWatchDirectory(dirPath);
            };
            watcher = new DiagnosticsWatcher(
                opts.workspaceUri,
                new SvelteCheck(opts.workspaceUri.fsPath, svelteCheckOptions),
                writer,
                opts.filePathsToIgnore,
                !!opts.tsconfig
            );
        } else {
            const svelteCheck = new SvelteCheck(opts.workspaceUri.fsPath, svelteCheckOptions);

            if (!opts.tsconfig) {
                await openAllDocuments(opts.workspaceUri, opts.filePathsToIgnore, svelteCheck);
            }
            const result = await getDiagnostics(opts.workspaceUri, writer, svelteCheck);
            if (
                result &&
                result.errorCount === 0 &&
                (!opts.failOnWarnings || result.warningCount === 0)
            ) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        }
    } catch (_err) {
        console.error(_err);
        console.error('svelte-check failed');
    }
});
