import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { SvelteCheckCliOptions } from './options';
import {
    DEFAULT_FILTER,
    DiagnosticFilter,
    HumanFriendlyWriter,
    MachineFriendlyWriter,
    Writer
} from './writers';

/**
 * Output and exit code, shared by the TypeScript 6 (`ts6.ts`) and TypeScript 7 (`ts7/`) paths.
 */

export type Result = {
    fileCount: number;
    errorCount: number;
    warningCount: number;
    fileCountWithProblems: number;
};

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

export function instantiateWriter(opts: SvelteCheckCliOptions): Writer {
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

export function writeDiagnostics(
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

export function getExitCode(result: Result | null, opts: SvelteCheckCliOptions): number {
    return result && result.errorCount === 0 && (!opts.failOnWarnings || result.warningCount === 0)
        ? 0
        : 1;
}

// `process.stdout.write` is asynchronous on non-TTY pipes, and `process.exit`
// does not wait for queued writes to drain. Under heavy diagnostic load this
// caused the output to be cut short when using `--output machine-verbose`.
export function exitAfterFlush(code: number): void {
    let pending = 2;
    const done = () => {
        if (--pending === 0) process.exit(code);
    };
    process.stdout.write('', done);
    process.stderr.write('', done);
}
