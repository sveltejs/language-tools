/**
 * This code's groundwork is taken from https://github.com/vuejs/vetur/tree/master/vti
 */

import * as fs from 'fs';
import * as glob from 'glob';
import * as argv from 'minimist';
import * as path from 'path';
import { SvelteCheck } from 'svelte-language-server';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { HumanFriendlyWriter, MachineFriendlyWriter, Writer } from './writers';
import { watch } from 'chokidar';

const outputFormats = ['human', 'human-verbose', 'machine'] as const;
type OutputFormat = typeof outputFormats[number];

type Result = {
    fileCount: number;
    errorCount: number;
    warningCount: number;
};

function openAllDocuments(
    workspaceUri: URI,
    filePathsToIgnore: string[],
    svelteCheck: SvelteCheck,
) {
    const files = glob.sync('**/*.svelte', {
        cwd: workspaceUri.fsPath,
        ignore: ['node_modules/**'].concat(filePathsToIgnore.map((ignore) => `${ignore}/**`)),
    });

    const absFilePaths = files.map((f) => path.resolve(workspaceUri.fsPath, f));

    for (const absFilePath of absFilePaths) {
        const text = fs.readFileSync(absFilePath, 'utf-8');
        svelteCheck.upsertDocument({
            uri: URI.file(absFilePath).toString(),
            text,
        });
    }
}

async function getDiagnostics(
    workspaceUri: URI,
    writer: Writer,
    svelteCheck: SvelteCheck,
): Promise<Result | null> {
    writer.start(workspaceUri.fsPath);

    try {
        const diagnostics = await svelteCheck.getDiagnostics();

        const result: Result = {
            fileCount: diagnostics.length,
            errorCount: 0,
            warningCount: 0,
        };

        for (const diagnostic of diagnostics) {
            writer.file(
                diagnostic.diagnostics,
                workspaceUri.fsPath,
                path.relative(workspaceUri.fsPath, diagnostic.filePath),
                diagnostic.text,
            );

            diagnostic.diagnostics.forEach((d: Diagnostic) => {
                if (d.severity === DiagnosticSeverity.Error) {
                    result.errorCount += 1;
                } else if (d.severity === DiagnosticSeverity.Warning) {
                    result.warningCount += 1;
                }
            });
        }

        writer.completion(result.fileCount, result.errorCount, result.warningCount);
        return result;
    } catch (err) {
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
    ) {
        watch(`${workspaceUri.fsPath}/**/*.svelte`, {
            ignored: ['node_modules']
                .concat(filePathsToIgnore)
                .map((ignore) => path.join(workspaceUri.fsPath, ignore)),
        })
            .on('add', (path) => this.updateDocument(path))
            .on('unlink', (path) => this.removeDocument(path))
            .on('change', (path) => this.updateDocument(path));
    }

    private updateDocument(path: string) {
        const text = fs.readFileSync(path, 'utf-8');
        this.svelteCheck.upsertDocument({ text, uri: URI.file(path).toString() });
        this.scheduleDiagnostics();
    }

    private removeDocument(path: string) {
        this.svelteCheck.removeDocument(URI.file(path).toString());
        this.scheduleDiagnostics();
    }

    private scheduleDiagnostics() {
        clearTimeout(this.updateDiagnostics);
        this.updateDiagnostics = setTimeout(
            () => getDiagnostics(this.workspaceUri, this.writer, this.svelteCheck),
            1000,
        );
    }
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

    const outputFormat: OutputFormat = outputFormats.includes(myArgs['output'])
        ? myArgs['output']
        : 'human-verbose';
    let writer: Writer;

    if (outputFormat === 'human-verbose' || outputFormat === 'human') {
        writer = new HumanFriendlyWriter(process.stdout, outputFormat === 'human-verbose');
    } else {
        writer = new MachineFriendlyWriter(process.stdout);
    }

    const svelteCheck = new SvelteCheck(workspaceUri.fsPath);
    const filePathsToIgnore = myArgs['ignore']?.split(',') || [];

    if (myArgs['watch']) {
        new DiagnosticsWatcher(workspaceUri, svelteCheck, writer, filePathsToIgnore);
    } else {
        openAllDocuments(workspaceUri, filePathsToIgnore, svelteCheck);
        const result = await getDiagnostics(workspaceUri, writer, svelteCheck);
        if (
            result &&
            result.errorCount === 0 &&
            (!myArgs['fail-on-warnings'] || result.warningCount === 0)
        ) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }
})().catch((_err) => {
    console.error(_err);
    console.error('svelte-check failed');
});
