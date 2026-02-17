/**
 * This code's groundwork is taken from https://github.com/vuejs/vetur/tree/master/vti
 */

import { watch, FSWatcher } from 'chokidar';
import * as fs from 'fs';
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
import {
    emitSvelteFiles,
    EmitResult,
    mapCliDiagnosticsToLsp,
    runTypeScriptDiagnostics,
    updateDiagnosticsCache,
    writeOverlayTsconfig
} from './incremental';
import { createIgnored, findFiles } from './utils';

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
    const absFilePaths = await findFiles(workspaceUri.fsPath, filePathsToIgnore, (filePath) =>
        filePath.endsWith('.svelte')
    );
    await openDocuments(absFilePaths, svelteCheck);
}

async function openDocuments(filePaths: string[], svelteCheck: SvelteCheck) {
    for (const absFilePath of filePaths) {
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

async function getDiagnostics(
    workspaceUri: URI,
    writer: Writer,
    svelteCheck: SvelteCheck
): Promise<Result | null> {
    try {
        const diagnostics = await svelteCheck.getDiagnostics();
        return writeDiagnostics(workspaceUri, writer, diagnostics);
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
                    stats?.isSocket() ||
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

        this.updateWildcardWatcher().then(() => {
            // ensuring the typescript program is built after wildcard watchers are added
            // so that individual file watchers added from onFileSnapshotCreated
            // run after the wildcard ones
            if (this.ignoreInitialAdd) {
                getDiagnostics(this.workspaceUri, this.writer, this.svelteCheck);
            }
        });
    }

    private isSubDir(candidate: string, parent: string) {
        const c = path.resolve(candidate);
        const p = path.resolve(parent);
        return c === p || c.startsWith(p + path.sep);
    }

    private minimizeDirs(dirs: string[]): string[] {
        const sorted = [...new Set(dirs.map((d) => path.resolve(d)))].sort();
        const result: string[] = [];
        for (const dir of sorted) {
            if (!result.some((p) => this.isSubDir(dir, p))) {
                result.push(dir);
            }
        }
        return result;
    }

    addWatchDirectory(dir: string) {
        if (!dir) {
            return;
        }

        // Skip if already covered by an existing watched directory
        for (const existing of this.currentWatchedDirs) {
            if (this.isSubDir(dir, existing)) {
                return;
            }
        }

        // Don't remove existing watchers, chokidar `unwatch` ignores future events from that path instead of closing the watcher in some cases
        for (const existing of this.currentWatchedDirs) {
            if (this.isSubDir(existing, dir)) {
                this.currentWatchedDirs.delete(existing);
            }
        }

        this.watcher.add(dir);
        this.currentWatchedDirs.add(dir);
    }

    private async updateWildcardWatcher() {
        const watchDirs = await this.svelteCheck.getWatchDirectories();
        const desired = this.minimizeDirs(
            (watchDirs?.map((d) => d.path) || [this.workspaceUri.fsPath]).map((p) =>
                path.resolve(p)
            )
        );

        const current = new Set([...this.currentWatchedDirs].map((p) => path.resolve(p)));

        const toAdd = desired.filter((d) => !current.has(d));
        if (toAdd.length) {
            this.watcher.add(toAdd);
        }

        this.currentWatchedDirs = new Set([...current, ...toAdd]);
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

    updateWildcardWatchers() {
        clearTimeout(this.pendingWatcherUpdate);
        this.pendingWatcherUpdate = setTimeout(() => this.updateWildcardWatcher(), 1000);
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

function writeDiagnostics(
    workspaceUri: URI,
    writer: Writer,
    diagnostics: Array<{ filePath: string; text: string; diagnostics: Diagnostic[] }>
): Result {
    writer.start(workspaceUri.fsPath);

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
}

async function getSvelteDiagnosticsForIncremental(
    opts: SvelteCheckCliOptions,
    emitResult: EmitResult
): Promise<{
    diagnostics: Array<{ filePath: string; text: string; diagnostics: Diagnostic[] }>;
    compilerWarningsByFile: Map<string, Diagnostic[]>;
    cssDiagnosticsByFile: Map<string, Diagnostic[]>;
}> {
    const sources = opts.diagnosticSources;
    if (!sources.includes('svelte') && !sources.includes('css')) {
        return {
            diagnostics: [],
            compilerWarningsByFile: new Map(),
            cssDiagnosticsByFile: new Map()
        };
    }

    const diagnosticsByFile = new Map<
        string,
        { filePath: string; text: string; diagnostics: Diagnostic[] }
    >();
    const compilerWarningsByFile = new Map<string, Diagnostic[]>();
    const cssDiagnosticsByFile = new Map<string, Diagnostic[]>();
    const changedFiles = new Set(emitResult.changedFiles);
    const filesNeedingDiagnostics: string[] = [];
    const enabledSources = sources.filter((source) => source !== 'js');

    // Phase 1: Partition files into "needs fresh diagnostics" vs "use cached diagnostics"
    for (const entry of emitResult.entries) {
        const needsSvelte =
            sources.includes('svelte') &&
            (!entry.compilerWarnings || changedFiles.has(entry.sourcePath));
        const needsCss =
            sources.includes('css') &&
            (!entry.cssDiagnostics || changedFiles.has(entry.sourcePath));
        if (needsSvelte || needsCss) {
            filesNeedingDiagnostics.push(entry.sourcePath);
            continue;
        }

        if (sources.includes('svelte') && entry.compilerWarnings) {
            const text = fs.readFileSync(entry.sourcePath, 'utf-8');
            diagnosticsByFile.set(entry.sourcePath, {
                filePath: entry.sourcePath,
                text,
                diagnostics: [...entry.compilerWarnings]
            });
        }
        if (sources.includes('css') && entry.cssDiagnostics) {
            const existing = diagnosticsByFile.get(entry.sourcePath) ?? {
                filePath: entry.sourcePath,
                text: fs.readFileSync(entry.sourcePath, 'utf-8'),
                diagnostics: []
            };
            existing.diagnostics.push(...entry.cssDiagnostics);
            diagnosticsByFile.set(entry.sourcePath, existing);
        }
    }

    // Phase 2: Run fresh diagnostics for changed/uncached files via the language server
    if (enabledSources.length && filesNeedingDiagnostics.length > 0) {
        const svelteCheck = new SvelteCheck(opts.workspaceUri.fsPath, {
            compilerWarnings: opts.compilerWarnings,
            diagnosticSources: enabledSources,
            watch: false
        });
        await openDocuments(filesNeedingDiagnostics, svelteCheck);
        const runDiagnostics = await svelteCheck.getDiagnostics();
        for (const entry of runDiagnostics) {
            diagnosticsByFile.set(entry.filePath, entry);
            if (sources.includes('svelte')) {
                compilerWarningsByFile.set(
                    entry.filePath,
                    entry.diagnostics.filter((diag) => diag.source === 'svelte')
                );
            }
            if (sources.includes('css')) {
                cssDiagnosticsByFile.set(
                    entry.filePath,
                    entry.diagnostics.filter((diag) => diag.source === 'css')
                );
            }
        }
        for (const filePath of filesNeedingDiagnostics) {
            if (sources.includes('svelte') && !compilerWarningsByFile.has(filePath)) {
                compilerWarningsByFile.set(filePath, []);
            }
            if (sources.includes('css') && !cssDiagnosticsByFile.has(filePath)) {
                cssDiagnosticsByFile.set(filePath, []);
            }
            if (!diagnosticsByFile.has(filePath)) {
                const text = fs.readFileSync(filePath, 'utf-8');
                const diagnostics: Diagnostic[] = [];
                if (sources.includes('svelte')) {
                    diagnostics.push(...(compilerWarningsByFile.get(filePath) ?? []));
                }
                if (sources.includes('css')) {
                    diagnostics.push(...(cssDiagnosticsByFile.get(filePath) ?? []));
                }
                diagnosticsByFile.set(filePath, {
                    filePath,
                    text,
                    diagnostics
                });
            }
        }
    }

    // Phase 3: Ensure every entry has a diagnostics record (empty if no diagnostics)
    for (const entry of emitResult.entries) {
        if (!diagnosticsByFile.has(entry.sourcePath)) {
            const text = fs.readFileSync(entry.sourcePath, 'utf-8');
            diagnosticsByFile.set(entry.sourcePath, {
                filePath: entry.sourcePath,
                text,
                diagnostics: []
            });
        }
    }

    return {
        diagnostics: Array.from(diagnosticsByFile.values()),
        compilerWarningsByFile,
        cssDiagnosticsByFile
    };
}

async function runWithVirtualFiles(
    opts: SvelteCheckCliOptions,
    writer: Writer
): Promise<Result | null> {
    if (!opts.tsconfig) {
        throw new Error('`--incremental` / `--tsgo` requires a tsconfig/jsconfig file');
    }

    const emitResult = await emitSvelteFiles(
        opts.workspaceUri.fsPath,
        opts.filePathsToIgnore,
        opts.incremental
    );
    const overlayTsconfig = writeOverlayTsconfig(opts.tsconfig, emitResult, opts.incremental);
    const tsDiagnostics = mapCliDiagnosticsToLsp(
        await runTypeScriptDiagnostics(
            overlayTsconfig,
            opts.tsgo,
            opts.incremental,
            opts.workspaceUri.fsPath
        ),
        emitResult
    );

    const {
        diagnostics: svelteDiagnostics,
        compilerWarningsByFile,
        cssDiagnosticsByFile
    } = await getSvelteDiagnosticsForIncremental(opts, emitResult);
    if (opts.incremental) {
        updateDiagnosticsCache(emitResult, {
            compilerWarningsByFile,
            cssDiagnosticsByFile
        });
    }
    const diagnosticsByFile = new Map<
        string,
        { filePath: string; text: string; diagnostics: Diagnostic[] }
    >();

    for (const entry of svelteDiagnostics) {
        diagnosticsByFile.set(entry.filePath, {
            filePath: entry.filePath,
            text: entry.text,
            diagnostics: entry.diagnostics
        });
    }

    for (const entry of tsDiagnostics) {
        const existing = diagnosticsByFile.get(entry.filePath) ?? {
            filePath: entry.filePath,
            text: entry.text,
            diagnostics: []
        };
        existing.diagnostics.push(...entry.diagnostics);
        diagnosticsByFile.set(entry.filePath, existing);
    }

    return writeDiagnostics(opts.workspaceUri, writer, Array.from(diagnosticsByFile.values()));
}

async function watchWithVirtualFiles(opts: SvelteCheckCliOptions, writer: Writer) {
    let pending: NodeJS.Timeout | undefined;
    let running = false;
    let rerun = false;
    const userIgnored = createIgnored(opts.filePathsToIgnore);

    const run = async () => {
        if (running) {
            rerun = true;
            return;
        }
        running = true;
        try {
            await runWithVirtualFiles(opts, writer);
        } catch (err: any) {
            writer.failure(err);
        } finally {
            running = false;
            if (rerun) {
                rerun = false;
                run();
            }
        }
    };

    const schedule = () => {
        clearTimeout(pending);
        pending = setTimeout(run, 1000);
    };

    await run();

    watch([], {
        ignored: (path, stats) => {
            if (
                path.includes('node_modules') ||
                path.includes('.git') ||
                (stats?.isFile() && (!FILE_ENDING_REGEX.test(path) || VITE_CONFIG_REGEX.test(path)))
            ) {
                return true;
            }

            if (userIgnored.length !== 0) {
                const workspaceRelative = path.startsWith(opts.workspaceUri.fsPath)
                    ? path.slice(opts.workspaceUri.fsPath.length + 1)
                    : path;
                for (const i of userIgnored) {
                    if (i(workspaceRelative)) {
                        return true;
                    }
                }
            }

            return false;
        },
        ignoreInitial: true
    })
        .on('add', schedule)
        .on('unlink', schedule)
        .on('change', schedule)
        .add(opts.workspaceUri.fsPath);
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

        const useVirtualFiles = opts.incremental || opts.tsgo;
        if (useVirtualFiles && opts.watch) {
            await watchWithVirtualFiles(opts, writer);
        } else if (useVirtualFiles) {
            const result = await runWithVirtualFiles(opts, writer);
            if (
                result &&
                result.errorCount === 0 &&
                (!opts.failOnWarnings || result.warningCount === 0)
            ) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        } else if (opts.watch) {
            // Wire callbacks that can reference the watcher instance created below
            let watcher: DiagnosticsWatcher;
            svelteCheckOptions.onProjectReload = () => {
                watcher.updateWildcardWatchers();
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
