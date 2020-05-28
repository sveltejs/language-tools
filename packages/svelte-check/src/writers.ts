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
    _stream: Writable;
    _isVerbose: boolean;

    constructor(stream: Writable, isVerbose = true) {
        this._stream = stream;
        this._isVerbose = isVerbose;
    }

    start(workspaceUri: string) {
        if (this._isVerbose) {
            this._stream.write('\n');
            this._stream.write(`Loading svelte-check in workspace: ${workspaceUri}`);
            this._stream.write('\n');
            this._stream.write('Getting Svelte diagnostics...\n');
            this._stream.write('====================================\n');
            this._stream.write('\n');
        }
    }

    file(diagnostics: Diagnostic[], filename: string, text: string): void {
        if (diagnostics.length > 0) {
            this._stream.write('\n');
            this._stream.write(`${chalk.green('File')} : ${chalk.green(filename)}\n`);

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

                if (this._isVerbose) {
                    msg = `${diagnostic.message} ${source}\n${position}\n${chalk.cyan(code)}`;
                }
                else {
                    msg = `${diagnostic.message} ${source}:${position}`;
                }

                if (diagnostic.severity === DiagnosticSeverity.Error) {
                    this._stream.write(`${chalk.red('Error')}: ${msg}\n`);
                }
                else {
                    this._stream.write(`${chalk.yellow('Warn')}: ${msg}\n`);
                }
            });

            this._stream.write('\n');
        }
    }

    completion(_f: number, err: number, _w: number) {
        this._stream.write('====================================\n');

        if (err === 0) {
            this._stream.write(chalk.green(`svelte-check found no errors\n`));
        } else {
            this._stream.write(chalk.red(`svelte-check found ${err} ${err === 1 ? 'error' : 'errors'}\n`));
        }
    }

    failure(err: Error) {
        this._stream.write(`${err}\n`);
    }
}

export class MachineFriendlyWriter implements Writer {
    _stream: Writable;

    constructor(stream: Writable) {
        this._stream = stream;
    }

    _log(msg: string) {
        this._stream.write(`${new Date().getTime()} ${msg}\n`);
    }

    start(workspaceUri: string) {
        this._log(`START ${JSON.stringify(workspaceUri)}`);
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
                this._log(`${type} ${fn} ${line}:${character} ${msg}`);
            }
        });
    }

    completion(fileCount: number, errorCount: number, warningCount: number) {
        this._log(`COMPLETED ${fileCount} FILES ${errorCount} ERRORS ${warningCount} WARNINGS`);
    }

    failure(err: Error) {
        this._log(`FAILURE ${JSON.stringify(err.message)}`);
    }
}
