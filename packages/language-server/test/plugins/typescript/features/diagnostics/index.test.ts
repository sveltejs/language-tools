import * as assert from 'assert';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { DiagnosticsProviderImpl } from '../../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { __resetCache } from '../../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../../src/utils';
import {
    createJsonSnapshotFormatter,
    createSnapshotTester,
    updateSnapshotIfFailedOrEmpty
} from '../../test-utils';
import { getPackageInfo } from '../../../../../src/importPackage';

function setup(workspaceDir: string, filePath: string) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(workspaceDir)],
        configManager
    );
    const plugin = new DiagnosticsProviderImpl(lsAndTsDocResolver, configManager);
    const document = docManager.openClientDocument(<any>{
        uri: pathToUrl(filePath),
        text: ts.sys.readFile(filePath) || ''
    });
    return { plugin, document, docManager, lsAndTsDocResolver };
}

const {
    version: { major }
} = getPackageInfo('svelte', __dirname);
const expected = 'expectedv2.json';
const newSvelteMajorExpected = `expected_svelte_${major}.json`;

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
    const { plugin, document } = setup(workspaceDir, inputFile);
    const diagnostics = await plugin.getDiagnostics(document);

    const defaultExpectedFile = join(dir, expected);
    const expectedFileForCurrentSvelteMajor = join(dir, newSvelteMajorExpected);
    const expectedFile = existsSync(expectedFileForCurrentSvelteMajor)
        ? expectedFileForCurrentSvelteMajor
        : defaultExpectedFile;
    const snapshotFormatter = await createJsonSnapshotFormatter(dir);

    await updateSnapshotIfFailedOrEmpty({
        assertion() {
            assert.deepStrictEqual(diagnostics, JSON.parse(readFileSync(expectedFile, 'utf-8')));
        },
        expectedFile,
        getFileContent() {
            return snapshotFormatter(diagnostics);
        },
        rootDir: __dirname
    });
}

const executeTests = createSnapshotTester(executeTest);

describe('DiagnosticsProvider', function () {
    executeTests({
        dir: join(__dirname, 'fixtures'),
        workspaceDir: join(__dirname, 'fixtures'),
        context: this
    });

    // Hacky, but it works. Needed due to testing both new and old transformation
    after(() => {
        __resetCache();
    });
});
