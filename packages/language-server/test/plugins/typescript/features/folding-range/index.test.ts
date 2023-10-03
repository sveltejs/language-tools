import * as assert from 'assert';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { FoldingRangeProviderImpl } from '../../../../../src/plugins/typescript/features/FoldingRangeProvider';
import { pathToUrl } from '../../../../../src/utils';
import {
    createJsonSnapshotFormatter,
    createSnapshotTester,
    updateSnapshotIfFailedOrEmpty
} from '../../test-utils';

function setup(workspaceDir: string, filePath: string) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    configManager.updateClientCapabilities({
        textDocument: { foldingRange: { lineFoldingOnly: true } }
    });
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(workspaceDir)],
        configManager
    );
    const plugin = new FoldingRangeProviderImpl(lsAndTsDocResolver, configManager);
    const document = docManager.openClientDocument(<any>{
        uri: pathToUrl(filePath),
        text: ts.sys.readFile(filePath) || ''
    });
    return { plugin, document, docManager, lsAndTsDocResolver };
}

async function executeTest(
    inputFile: string,
    {
        workspaceDir,
        dir
    }: {
        workspaceDir: string;
        dir: string;
    }
) {
    const expected = 'expectedv2.json';
    const { plugin, document } = setup(workspaceDir, inputFile);
    const folding = await plugin.getFoldingRanges(document);

    const expectedFile = join(dir, expected);
    if (process.argv.includes('--debug')) {
        writeFileSync(join(dir, 'debug.svelte'), appendFoldingAsComment());
    }

    const snapshotFormatter = await createJsonSnapshotFormatter(dir);

    await updateSnapshotIfFailedOrEmpty({
        assertion() {
            assert.deepStrictEqual(
                JSON.parse(JSON.stringify(folding)),
                JSON.parse(readFileSync(expectedFile, 'utf-8'))
            );
        },
        expectedFile,
        getFileContent() {
            return snapshotFormatter(folding);
        },
        rootDir: __dirname
    });

    function appendFoldingAsComment() {
        if (!folding) {
            return document.getText();
        }

        const offsetMap = new Map<number, string[]>();
        const lineLength = document
            .getText()
            .split('\n')
            .map((line) => (line[line.length - 1] === '\r' ? line.length - 1 : line.length));

        for (const fold of folding) {
            const startOffset = document.offsetAt({
                line: fold.startLine,
                character: lineLength[fold.startLine]
            });
            const endOffset = document.offsetAt({
                line: fold.endLine,
                character: lineLength[fold.endLine]
            });

            offsetMap.set(startOffset, (offsetMap.get(startOffset) ?? []).concat(`/*s*/`));
            offsetMap.set(endOffset, (offsetMap.get(endOffset) ?? []).concat(`/*e*/`));
        }

        const offsets = Array.from(offsetMap.keys()).sort((a, b) => a - b);
        const parts: string[] = [];

        for (let index = 0; index < offsets.length; index++) {
            const offset = offsets[index];
            parts.push(
                document.getText().slice(offsets[index - 1], offset),
                ...(offsetMap.get(offset) ?? [])
            );
        }

        parts.push(document.getText().slice(offsets[offsets.length - 1]));

        return parts.join('');
    }
}

const executeTests = createSnapshotTester(executeTest);

describe('FoldingRangeProvider', function () {
    executeTests({
        dir: join(__dirname, 'fixtures'),
        workspaceDir: join(__dirname, 'fixtures'),
        context: this
    });
});
