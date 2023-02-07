import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { DiagnosticsProviderImpl } from '../../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { __resetCache } from '../../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../../src/utils';
import { createSnapshotTester, updateSnapshotIfFailedOrEmpty } from '../../test-utils';

function setup(workspaceDir: string, filePath: string, useNewTransformation: boolean) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    configManager.update({ svelte: { useNewTransformation } });
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(workspaceDir)],
        configManager
    );
    const plugin = new DiagnosticsProviderImpl(lsAndTsDocResolver, configManager);
    const document = docManager.openDocument(<any>{
        uri: pathToUrl(filePath),
        text: ts.sys.readFile(filePath) || ''
    });
    return { plugin, document, docManager, lsAndTsDocResolver };
}

async function executeTest(
    inputFile: string,
    {
        workspaceDir,
        dir,
        useNewTransformation
    }: {
        workspaceDir: string;
        dir: string;
        useNewTransformation: boolean;
    }
) {
    const expected = useNewTransformation ? 'expectedv2.json' : 'expected.json';
    const { plugin, document } = setup(workspaceDir, inputFile, useNewTransformation);
    const diagnostics = await plugin.getDiagnostics(document);

    const expectedFile = join(dir, expected);
    updateSnapshotIfFailedOrEmpty({
        assertion() {
            assert.deepStrictEqual(diagnostics, JSON.parse(readFileSync(expectedFile, 'utf-8')));
        },
        expectedFile,
        getFileContent() {
            return JSON.stringify(diagnostics, null, 4);
        },
        rootDir: __dirname
    });
}

const executeTests = createSnapshotTester(executeTest);

describe('DiagnosticsProvider', () => {
    // describe('(old transformation)', () => {
    //     executeTests({
    //     dir: join(__dirname, 'fixtures'),
    //     workspaceDir: join(__dirname, 'fixtures'),
    //     useNewTransformation: false
    // });
    //     // Hacky, but it works. Needed due to testing both new and old transformation
    //     after(() => {
    //         __resetCache();
    //     });
    // });

    describe('new transformation', () => {
        executeTests({
            dir: join(__dirname, 'fixtures'),
            workspaceDir: join(__dirname, 'fixtures'),
            useNewTransformation: true
        });
        // Hacky, but it works. Needed due to testing both new and old transformation
        after(() => {
            __resetCache();
        });
    });
});
