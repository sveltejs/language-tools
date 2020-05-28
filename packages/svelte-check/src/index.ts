import * as fs from 'fs';
import * as glob from 'glob';
import * as argv from 'minimist';
import * as path from 'path';
import { Duplex } from 'stream';
import { startServer } from 'svelte-language-server';
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
import { Writer, HumanFriendlyWriter, MachineFriendlyWriter } from "./writers";

const outputFormats = ["human", "human-verbose", "machine"] as const;
type OutputFormat = typeof outputFormats[number];

type Result = {
    fileCount: number;
    errorCount: number;
    warningCount: number;
};

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

async function getDiagnostics(workspaceUri: URI, writer: Writer): Promise<Result | null> {
    writer.start(workspaceUri.fsPath);

    const clientConnection = await prepareClientConnection();

    const files = glob.sync('**/*.svelte', {
        cwd: workspaceUri.fsPath,
        ignore: ['node_modules/**'],
    });

    const absFilePaths = files.map((f) => path.resolve(workspaceUri.fsPath, f));

    const result = {
        fileCount: absFilePaths.length,
        errorCount: 0,
        warningCount: 0
    };

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

        let res: Diagnostic[] = [];

        try {
            res = (await clientConnection.sendRequest('$/getDiagnostics', {
                uri: URI.file(absFilePath).toString(),
            })) as Diagnostic[];
        } catch (err) {
            writer.failure(err);
            return null;
        }

        writer.file(res, path.relative(workspaceUri.fsPath, absFilePath), text);

        res.forEach((d: Diagnostic) => {
            if (d.severity === DiagnosticSeverity.Error) {
                result.errorCount += 1;
            }
            else if (d.severity === DiagnosticSeverity.Warning) {
                result.warningCount += 1;
            }
        });
    }

    writer.completion(result.fileCount, result.errorCount, result.warningCount);

    return result;
}

(async () => {
    const myArgs = argv(process.argv.slice(1));
    let workspaceUri;

    let workspacePath = myArgs['workspace'];
    if (workspacePath) {
        if (!path.isAbsolute(workspacePath)) {
            workspacePath = path.resolve(process.cwd(), workspacePath);
        }
        workspaceUri = URI.file(workspacePath);
    } else {
        workspaceUri = URI.file(process.cwd());
    }

    const outputFormat: OutputFormat = outputFormats.includes(myArgs['output']) ? myArgs['output'] : "human-verbose";
    let writer: Writer;

    if (outputFormat === "human-verbose" || outputFormat === "human") {
        writer = new HumanFriendlyWriter(process.stdout, outputFormat === "human-verbose");
    }
    else {
        writer = new MachineFriendlyWriter(process.stdout);
    }

    const result = await getDiagnostics(workspaceUri, writer);

    if (result && (result as Result).errorCount === 0) {
        process.exit(0);
    } else {
        process.exit(1);
    }
})().catch((_err) => {
    console.error(_err);
    console.error('svelte-check failed');
});
