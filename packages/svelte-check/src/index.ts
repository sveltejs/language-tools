import * as chalk from 'chalk';
import * as fs from 'fs';
import * as glob from 'glob';
import * as argv from 'minimist';
import * as path from 'path';
import { Duplex } from 'stream';
import { offsetAt, startServer } from 'svelte-language-server';
import { createConnection } from 'vscode-languageserver';
import {
    createProtocolConnection,
    Diagnostic,
    DiagnosticSeverity,
    DidOpenTextDocumentNotification,
    Logger,
    StreamMessageReader,
    StreamMessageWriter,
} from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

/* eslint-disable @typescript-eslint/no-empty-function */
class NullLogger implements Logger {
    error(_message: string): void {}
    warn(_message: string): void {}
    info(_message: string): void {}
    log(_message: string): void {}
}

class TestStream extends Duplex {
    _write(chunk: string, _encoding: string, done: () => void) {
        this.emit('data', chunk);
        done();
    }

    _read(_size: number) {}
}
/* eslint-enable @typescript-eslint/no-empty-function */

async function prepareClientConnection() {
    const up = new TestStream();
    const down = new TestStream();
    const logger = new NullLogger();

    const clientConnection = createProtocolConnection(
        new StreamMessageReader(down),
        new StreamMessageWriter(up),
        logger,
    );

    const serverConnection = createConnection(
        new StreamMessageReader(up),
        new StreamMessageWriter(down),
    );
    startServer({ connection: serverConnection, logErrorsOnly: true });

    clientConnection.listen();
    return clientConnection;
}

function logDiagnostic(diagnostic: Diagnostic, text: string): 0 | 1 {
    const source = diagnostic.source ? `(${diagnostic.source})` : '';
    // eslint-disable-next-line max-len
    const position = `Line: ${diagnostic.range.start.line}, Character: ${diagnostic.range.start.character}`;
    // Show some context around diagnostic range
    const startOffset = offsetAt(diagnostic.range.start, text);
    const endOffset = offsetAt(diagnostic.range.end, text);
    const codePrev = chalk.cyan(text.substring(Math.max(startOffset - 10, 0), startOffset));
    const codeHighlight = chalk.magenta(text.substring(startOffset, endOffset));
    const codePost = chalk.cyan(text.substring(endOffset, endOffset + 10));
    const code = codePrev + codeHighlight + codePost;
    const msg = `${diagnostic.message} ${source}\n${position}\n${chalk.cyan(code)}`;

    if (diagnostic.severity === DiagnosticSeverity.Error) {
        console.log(`${chalk.red('Error')}: ${msg}`);
        return 1;
    }

    console.log(`${chalk.yellow('Warn')} : ${msg}`);
    return 0;
}

async function getDiagnostics(workspaceUri: URI) {
    const clientConnection = await prepareClientConnection();

    const files = glob.sync('**/*.svelte', {
        cwd: workspaceUri.fsPath,
        ignore: ['node_modules/**'],
    });
    const absFilePaths = files.map((f) => path.resolve(workspaceUri.fsPath, f));

    console.log('');
    let errCount = 0;

    for (const absFilePath of absFilePaths) {
        const text = fs.readFileSync(absFilePath, 'utf-8');
        clientConnection.sendNotification(DidOpenTextDocumentNotification.type, {
            textDocument: {
                languageId: 'svelte',
                uri: URI.file(absFilePath).toString(),
                version: 1,
                text,
            },
        });

        try {
            const res = (await clientConnection.sendRequest('$/getDiagnostics', {
                uri: URI.file(absFilePath).toString(),
            })) as Diagnostic[];
            if (res.length > 0) {
                console.log('');
                console.log(`${chalk.green('File')} : ${chalk.green(absFilePath)}`);
                res.forEach((d) => (errCount += logDiagnostic(d, text)));
                console.log('');
            }
        } catch (err) {
            console.log(err);
        }
    }

    return errCount;
}

(async () => {
    const myArgs = argv(process.argv.slice(1));
    let workspaceUri;

    let workspacePath = myArgs['workspace'];
    if (workspacePath) {
        if (!path.isAbsolute(workspacePath)) {
            workspacePath = path.resolve(process.cwd(), workspacePath);
        }
        console.log(`Loading Svelte-Check in workspace path: ${workspacePath}`);
        workspaceUri = URI.file(workspacePath);
    } else {
        console.log(`Loading Svelte-Check in current directory: ${process.cwd()}`);
        workspaceUri = URI.file(process.cwd());
    }

    console.log('');
    console.log('Getting Svelte diagnostics...');
    console.log('====================================');
    const errCount = await getDiagnostics(workspaceUri);
    console.log('====================================');

    if (errCount === 0) {
        console.log(chalk.green(`Svelte-Check found no error`));
        process.exit(0);
    } else {
        console.log(
            chalk.red(`Svelte-Check found ${errCount} ${errCount === 1 ? 'error' : 'errors'}`),
        );
        process.exit(1);
    }
})().catch((_err) => {
    console.error(_err);
    console.error('Svelte-Check failed');
});
