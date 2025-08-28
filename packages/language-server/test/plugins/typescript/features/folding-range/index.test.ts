import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { FoldingRangeProviderImpl } from '../../../../../src/plugins/typescript/features/FoldingRangeProvider';
import { pathToUrl } from '../../../../../src/utils';
import {
    serviceWarmup,
    updateSnapshotIfFailedOrEmpty,
    createJsonSnapshotFormatter
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

describe('FoldingRangeProvider', () => {
    const fixturesDir = join(__dirname, 'fixtures');
    const workspaceDir = join(__dirname, '../../testfiles');

    beforeAll(() => {
        serviceWarmup(workspaceDir, pathToUrl(workspaceDir));
    });

    // Get all test fixtures
    const testFiles = readdirSync(fixturesDir).filter((entry) => {
        const fullPath = join(fixturesDir, entry);
        const inputFile = join(fullPath, 'input.svelte');
        return statSync(fullPath).isDirectory() && existsSync(inputFile);
    });

    for (const testName of testFiles) {
        it(testName, async () => {
            const inputFile = join(fixturesDir, testName, 'input.svelte');
            const { plugin, document } = setup(workspaceDir, inputFile);
            const folding = await plugin.getFoldingRanges(document);

            // Compare against file-based expected output (expectedv2.json)
            const expectedFile = join(fixturesDir, testName, 'expectedv2.json');
            const formatJson = await createJsonSnapshotFormatter(__dirname);

            await updateSnapshotIfFailedOrEmpty({
                assertion: () =>
                    expect(folding).toEqual(JSON.parse(readFileSync(expectedFile, 'utf-8'))),
                expectedFile,
                rootDir: fixturesDir,
                getFileContent: () => formatJson(folding)
            });
        });
    }
});
