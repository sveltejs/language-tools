/**
 * This code's groundwork is taken from https://github.com/vuejs/vetur/tree/master/vti
 */

import { watch } from 'chokidar';
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

class DiagnosticsWatcher {
    private updateDiagnostics: any;

    constructor(
        private workspaceUri: URI,
        private svelteCheck: SvelteCheck,
        private writer: Writer,
        filePathsToIgnore: string[],
        ignoreInitialAdd: boolean
    ) {
        const fileEnding = /\.(svelte|d\.ts|ts|js|jsx|tsx|mjs|cjs|mts|cts)$/;
        const viteConfigRegex = /vite\.config\.(js|ts)\.timestamp-/;
        const userIgnored = createIgnored(filePathsToIgnore);
        const offset = workspaceUri.fsPath.length + 1;

        watch(workspaceUri.fsPath, {
            ignored: (path, stats) => {
                if (
                    path.includes('node_modules') ||
                    path.includes('.git') ||
                    (stats?.isFile() && (!fileEnding.test(path) || viteConfigRegex.test(path)))
                ) {
                    return true;
                }

                if (userIgnored.length !== 0) {
                    path = path.slice(offset);
                    for (const i of userIgnored) {
                        if (i(path)) {
                            return true;
                        }
                    }
                }

                return false;
            },
            ignoreInitial: ignoreInitialAdd
        })
            .on('add', (path) => this.updateDocument(path, true))
            .on('unlink', (path) => this.removeDocument(path))
            .on('change', (path) => this.updateDocument(path, false));

        if (ignoreInitialAdd) {
            this.scheduleDiagnostics();
        }
    }

    private async updateDocument(path: string, isNew: boolean) {
        const text = fs.readFileSync(path, 'utf-8');
        await this.svelteCheck.upsertDocument({ text, uri: URI.file(path).toString() }, isNew);
        this.scheduleDiagnostics();
    }

    private async removeDocument(path: string) {
        await this.svelteCheck.removeDocument(URI.file(path).toString());
        this.scheduleDiagnostics();
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
            svelteCheckOptions.onProjectReload = () => watcher.scheduleDiagnostics();
            const watcher = new DiagnosticsWatcher(
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
