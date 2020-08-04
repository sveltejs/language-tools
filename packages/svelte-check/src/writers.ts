import * as chalk from 'chalk';
import { sep } from 'path';
import { Writable } from 'stream';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { offsetAt } from 'svelte-language-server';

export interface Writer {
    start: (workspaceDir: string) => void;
    file: (d: Diagnostic[], workspaceDir: string, filename: string, text: string) => void;
    completion: (fileCount: number, errorCount: number, warningCount: number) => void;
    failure: (err: Error) => void;
}

export class HumanFriendlyWriter implements Writer {
    constructor(private stream: Writable, private isVerbose = true) {}

    start(workspaceDir: string) {
        if (this.isVerbose) {
            this.stream.write('\n');
            this.stream.write(`Loading svelte-check in workspace: ${workspaceDir}`);
            this.stream.write('\n');
            this.stream.write('Getting Svelte diagnostics...\n');
            this.stream.write('====================================\n');
            this.stream.write('\n');
        }
    }

    file(diagnostics: Diagnostic[], workspaceDir: string, filename: string, text: string): void {
        diagnostics.forEach((diagnostic) => {
            const source = diagnostic.source ? `(${diagnostic.source})` : '';

            // Display location in a format that IDEs will turn into file links
            const { line, character } = diagnostic.range.start;
            // eslint-disable-next-line max-len
            this.stream.write(
                `${workspaceDir}${sep}${chalk.green(filename)}:${line + 1}:${character + 1}\n`,
            );

            // Show some context around diagnostic range
            const startOffset = offsetAt(diagnostic.range.start, text);
            const endOffset = offsetAt(diagnostic.range.end, text);
            const codePrev = chalk.cyan(text.substring(Math.max(startOffset - 10, 0), startOffset));
            const codeHighlight = chalk.magenta(text.substring(startOffset, endOffset));
            const codePost = chalk.cyan(text.substring(endOffset, endOffset + 10));
            const code = codePrev + codeHighlight + codePost;
            let msg;

            if (this.isVerbose) {
                msg = `${diagnostic.message} ${source}\n${chalk.cyan(code)}`;
            } else {
                msg = `${diagnostic.message} ${source}`;
            }

            if (diagnostic.severity === DiagnosticSeverity.Error) {
                this.stream.write(`${chalk.red('Error')}: ${msg}\n`);
            } else if (diagnostic.severity === DiagnosticSeverity.Warning) {
                this.stream.write(`${chalk.yellow('Warn')}: ${msg}\n`);
            } else {
                this.stream.write(`${chalk.gray('Hint')}: ${msg}\n`);
            }

            this.stream.write('\n');
        });
    }

    completion(_f: number, errorCount: number, warningCount: number) {
        this.stream.write('====================================\n');

        if (errorCount === 0 && warningCount === 0) {
            this.stream.write(chalk.green(`svelte-check found no errors and no warnings\n`));
        } else if (errorCount === 0) {
            this.stream.write(
                chalk.yellow(
                    `svelte-check found ${warningCount} ${
                        warningCount === 1 ? 'warning' : 'warnings'
                    }\n`,
                ),
            );
        } else {
            this.stream.write(
                chalk.red(
                    `svelte-check found ${errorCount} ${
                        errorCount === 1 ? 'error' : 'errors'
                    } and ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}\n`,
                ),
            );
        }
    }

    failure(err: Error) {
        this.stream.write(`${err}\n`);
    }
}

export class MachineFriendlyWriter implements Writer {
    constructor(private stream: Writable) {}

    private log(msg: string) {
        this.stream.write(`${new Date().getTime()} ${msg}\n`);
    }

    start(workspaceDir: string) {
        this.log(`START ${JSON.stringify(workspaceDir)}`);
    }

    file(diagnostics: Diagnostic[], workspaceDir: string, filename: string, _text: string) {
        diagnostics.forEach((d) => {
            const { message, severity, range } = d;
            const type =
                severity === DiagnosticSeverity.Error
                    ? 'ERROR'
                    : severity === DiagnosticSeverity.Warning
                    ? 'WARNING'
                    : null;

            if (type) {
                const { line, character } = range.start;
                const fn = JSON.stringify(filename);
                const msg = JSON.stringify(message);
                this.log(`${type} ${fn} ${line + 1}:${character + 1} ${msg}`);
            }
        });
    }

    completion(fileCount: number, errorCount: number, warningCount: number) {
        this.log(`COMPLETED ${fileCount} FILES ${errorCount} ERRORS ${warningCount} WARNINGS`);
    }

    failure(err: Error) {
        this.log(`FAILURE ${JSON.stringify(err.message)}`);
    }
}
