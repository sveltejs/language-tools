import pc from 'picocolors';
import { sep } from 'path';
import { Writable } from 'stream';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { offsetAt } from 'svelte-language-server';

export interface Writer {
    start: (workspaceDir: string) => void;
    file: (d: Diagnostic[], workspaceDir: string, filename: string, text: string) => void;
    completion: (
        fileCount: number,
        errorCount: number,
        warningCount: number,
        fileCountWithProblems: number
    ) => void;
    failure: (err: Error) => void;
}

export type DiagnosticFilter = (diagnostic: Diagnostic) => boolean;
export const DEFAULT_FILTER: DiagnosticFilter = () => true;

export class HumanFriendlyWriter implements Writer {
    constructor(
        private stream: Writable,
        private isVerbose = true,
        private isWatchMode = false,
        private clearScreen = true,
        private diagnosticFilter: DiagnosticFilter = DEFAULT_FILTER
    ) {}

    start(workspaceDir: string) {
        if (process.stdout.isTTY && this.isWatchMode && this.clearScreen) {
            // Clear screen
            const blank = '\n'.repeat(process.stdout.rows);
            this.stream.write(blank);
            process.stdout.cursorTo(0, 0);
            process.stdout.clearScreenDown();
        }

        if (this.isVerbose) {
            this.stream.write('\n');
            this.stream.write('====================================\n');
            this.stream.write(`Loading svelte-check in workspace: ${workspaceDir}`);
            this.stream.write('\n');
            this.stream.write('Getting Svelte diagnostics...\n');
            this.stream.write('\n');
        }
    }

    file(diagnostics: Diagnostic[], workspaceDir: string, filename: string, text: string): void {
        diagnostics.filter(this.diagnosticFilter).forEach((diagnostic) => {
            const source = diagnostic.source ? `(${diagnostic.source})` : '';

            // Display location in a format that IDEs will turn into file links
            const { line, character } = diagnostic.range.start;
            this.stream.write(
                `${workspaceDir}${sep}${pc.green(filename)}:${line + 1}:${character + 1}\n`
            );

            let msg;
            if (this.isVerbose) {
                const code = this.formatRelatedCode(diagnostic, text);
                msg = `${diagnostic.message} ${source}\n${pc.cyan(code)}`;
            } else {
                msg = `${diagnostic.message} ${source}`;
            }

            if (diagnostic.severity === DiagnosticSeverity.Error) {
                this.stream.write(`${pc.red('Error')}: ${msg}\n`);
            } else if (diagnostic.severity === DiagnosticSeverity.Warning) {
                this.stream.write(`${pc.yellow('Warn')}: ${msg}\n`);
            }

            this.stream.write('\n');
        });
    }

    private formatRelatedCode(diagnostic: Diagnostic, text: string) {
        if (!text) {
            return '';
        }

        // Show some context around diagnostic range
        const codePrevLine = this.getLine(diagnostic.range.start.line - 1, text);
        const codeLine = this.getCodeLine(diagnostic, text);
        const codeNextLine = this.getLine(diagnostic.range.end.line + 1, text);
        const code = codePrevLine + codeLine + codeNextLine;

        return code;
    }

    private getCodeLine(diagnostic: Diagnostic, text: string) {
        const startOffset = offsetAt(diagnostic.range.start, text);
        const endOffset = offsetAt(diagnostic.range.end, text);
        const codePrev = text.substring(
            offsetAt({ line: diagnostic.range.start.line, character: 0 }, text),
            startOffset
        );
        const codeHighlight = pc.magenta(text.substring(startOffset, endOffset));
        const codePost = text.substring(
            endOffset,
            offsetAt({ line: diagnostic.range.end.line, character: Number.MAX_SAFE_INTEGER }, text)
        );
        return codePrev + codeHighlight + codePost;
    }

    private getLine(line: number, text: string): string {
        return text.substring(
            offsetAt({ line, character: 0 }, text),
            offsetAt({ line, character: Number.MAX_SAFE_INTEGER }, text)
        );
    }

    completion(
        _f: number,
        errorCount: number,
        warningCount: number,
        fileCountWithProblems: number
    ) {
        this.stream.write('====================================\n');
        const message = [
            'svelte-check found ',
            `${errorCount} ${errorCount === 1 ? 'error' : 'errors'} and `,
            `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`,
            `${
                fileCountWithProblems
                    ? // prettier-ignore
                      ` in ${fileCountWithProblems} ${fileCountWithProblems === 1 ? 'file' : 'files'}`
                    : ''
            }\n`
        ].join('');
        if (errorCount !== 0) {
            this.stream.write(pc.red(message));
        } else if (warningCount !== 0) {
            this.stream.write(pc.yellow(message));
        } else {
            this.stream.write(pc.green(message));
        }
        if (this.isWatchMode) {
            this.stream.write('Watching for file changes...');
        }
    }

    failure(err: Error) {
        this.stream.write(`${err}\n`);
    }
}

export class MachineFriendlyWriter implements Writer {
    constructor(
        private stream: Writable,
        private isVerbose = false,
        private diagnosticFilter = DEFAULT_FILTER
    ) {}

    private log(msg: string) {
        this.stream.write(`${new Date().getTime()} ${msg}\n`);
    }

    start(workspaceDir: string) {
        this.log(`START ${JSON.stringify(workspaceDir)}`);
    }

    file(diagnostics: Diagnostic[], workspaceDir: string, filename: string, _text: string) {
        diagnostics.filter(this.diagnosticFilter).forEach((d) => {
            const { message, severity, range, code, codeDescription, source } = d;
            const type =
                severity === DiagnosticSeverity.Error
                    ? 'ERROR'
                    : severity === DiagnosticSeverity.Warning
                      ? 'WARNING'
                      : null;

            if (type) {
                const { start, end } = range;
                if (this.isVerbose) {
                    this.log(
                        JSON.stringify({
                            type,
                            filename,
                            start,
                            end,
                            message,
                            code,
                            codeDescription,
                            source
                        })
                    );
                } else {
                    const fn = JSON.stringify(filename);
                    const msg = JSON.stringify(message);
                    this.log(`${type} ${fn} ${start.line + 1}:${start.character + 1} ${msg}`);
                }
            }
        });
    }

    completion(
        fileCount: number,
        errorCount: number,
        warningCount: number,
        fileCountWithProblems: number
    ) {
        this.log(
            [
                'COMPLETED',
                `${fileCount} FILES`,
                `${errorCount} ERRORS`,
                `${warningCount} WARNINGS`,
                `${fileCountWithProblems} FILES_WITH_PROBLEMS`
            ].join(' ')
        );
    }

    failure(err: Error) {
        this.log(`FAILURE ${JSON.stringify(err.message)}`);
    }
}
