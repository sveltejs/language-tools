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

const outputFormats = ['human', 'human-verbose', 'machine'] as const;
type OutputFormat = typeof outputFormats[number];

type Result = {
    fileCount: number;
    errorCount: number;
    warningCount: number;
};

async function getDiagnostics(workspaceUri: URI, writer: Writer): Promise<Result | null> {
    writer.start(workspaceUri.fsPath);

    const svelteCheck = new SvelteCheck(workspaceUri.fsPath);

    const files = glob.sync('**/*.svelte', {
        cwd: workspaceUri.fsPath,
        ignore: ['node_modules/**'],
    });

    const absFilePaths = files.map((f) => path.resolve(workspaceUri.fsPath, f));

    const result = {
        fileCount: absFilePaths.length,
        errorCount: 0,
        warningCount: 0,
    };

    for (const absFilePath of absFilePaths) {
        const text = fs.readFileSync(absFilePath, 'utf-8');

        let res: Diagnostic[] = [];

        try {
            res = await svelteCheck.getDiagnostics({
                uri: URI.file(absFilePath).toString(),
                text,
            });
        } catch (err) {
            writer.failure(err);
            return null;
        }

        writer.file(
            res,
            workspaceUri.fsPath,
            path.relative(workspaceUri.fsPath, absFilePath),
            text,
        );

        res.forEach((d: Diagnostic) => {
            if (d.severity === DiagnosticSeverity.Error) {
                result.errorCount += 1;
            } else if (d.severity === DiagnosticSeverity.Warning) {
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

    const outputFormat: OutputFormat = outputFormats.includes(myArgs['output'])
        ? myArgs['output']
        : 'human-verbose';
    let writer: Writer;

    if (outputFormat === 'human-verbose' || outputFormat === 'human') {
        writer = new HumanFriendlyWriter(process.stdout, outputFormat === 'human-verbose');
    } else {
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
