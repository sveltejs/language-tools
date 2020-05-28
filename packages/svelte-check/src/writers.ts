import * as chalk from 'chalk';
import { Writable } from "stream";
import {
    Diagnostic,
    DiagnosticSeverity,
} from 'vscode-languageserver-protocol';
import { offsetAt } from 'svelte-language-server';

export interface Writer {
    start: (workspaceUri: string) => void;
    file: (d: Diagnostic[], filename: string, text: string) => void;
    completion: (fileCount: number, errorCount: number, warningCount: number) => void;
    failure: (err: Error) => void;
}

export class HumanFriendlyWriter implements Writer {
    constructor(private stream: Writable, private isVerbose = true) {
        this.stream = stream;
        this.isVerbose = isVerbose;
    }

    start(workspaceUri: string) {
        if (this.isVerbose) {
            this.stream.write('\n');
            this.stream.write(`Loading svelte-check in workspace: ${workspaceUri}`);
            this.stream.write('\n');
            this.stream.write('Getting Svelte diagnostics...\n');
            this.stream.write('====================================\n');
            this.stream.write('\n');
        }
    }

    file(diagnostics: Diagnostic[], filename: string, text: string): void {
        if (diagnostics.length > 0) {
            this.stream.write('\n');
            this.stream.write(`${chalk.green('File')} : ${chalk.green(filename)}\n`);

            diagnostics.forEach((diagnostic) => {
                const source = diagnostic.source ? `(${diagnostic.source})` : '';
                const { line, character } = diagnostic.range.start;

                // eslint-disable-next-line max-len
                const position = `Line: ${line}, Character: ${character}`;

                // Show some context around diagnostic range
                const startOffset = offsetAt(diagnostic.range.start, text);
                const endOffset = offsetAt(diagnostic.range.end, text);
                const codePrev = chalk.cyan(
                  text.substring(Math.max(startOffset - 10, 0), startOffset)
                );
                const codeHighlight = chalk.magenta(text.substring(startOffset, endOffset));
                const codePost = chalk.cyan(text.substring(endOffset, endOffset + 10));
                const code = codePrev + codeHighlight + codePost;
                let msg;

                if (this.isVerbose) {
                    msg = `${diagnostic.message} ${source}\n${position}\n${chalk.cyan(code)}`;
                }
                else {
                    msg = `${diagnostic.message} ${source}:${position}`;
                }

                if (diagnostic.severity === DiagnosticSeverity.Error) {
                    this.stream.write(`${chalk.red('Error')}: ${msg}\n`);
                }
                else {
                    this.stream.write(`${chalk.yellow('Warn')}: ${msg}\n`);
                }
            });

            this.stream.write('\n');
        }
    }

    completion(_f: number, err: number, _w: number) {
        this.stream.write('====================================\n');

        if (err === 0) {
            this.stream.write(chalk.green(`svelte-check found no errors\n`));
        } else {
            this.stream.write(chalk.red(`svelte-check found ${err} ${err === 1 ? 'error' : 'errors'}\n`));
        }
    }

    failure(err: Error) {
        this.stream.write(`${err}\n`);
    }
}

export class MachineFriendlyWriter implements Writer {
    constructor(private stream: Writable) {
        this.stream = stream;
    }

    private log(msg: string) {
        this.stream.write(`${new Date().getTime()} ${msg}\n`);
    }

    start(workspaceUri: string) {
        this.log(`START ${JSON.stringify(workspaceUri)}`);
    }

    file(diagnostics: Diagnostic[], filename: string, _text: string) {
        diagnostics.forEach((d) => {
            const { message, severity, range } = d;
            const type =
              severity === DiagnosticSeverity.Error ? "ERROR" :
              severity === DiagnosticSeverity.Warning ? "WARNING" :
              null;

            if (type) {
                const { line, character } = range.start;
                const fn = JSON.stringify(filename);
                const msg = JSON.stringify(message);
                this.log(`${type} ${fn} ${line}:${character} ${msg}`);
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
