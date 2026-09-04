import ts from 'typescript';
import { pathToUrl } from '../../../../../src/utils';
import { createSnapshotTesterForTsGo } from '../../test-utils';
import { DiagnosticsProvider } from '../../../../../src/plugins';
import { Document } from '../../../../../src/lib/documents';
import {
    createJsonSnapshotFormatter,
    updateSnapshotIfFailedOrEmpty
} from '../../../typescript/test-utils';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getPackageInfo } from '../../../../../src/importPackage';
import { VERSION } from 'svelte/compiler';
import {
    Diagnostic,
    DiagnosticTag,
    DocumentDiagnosticRequest,
    PublishDiagnosticsClientCapabilities
} from 'vscode-languageserver';
import { TsLSPService } from '../../lspService';

const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

const root = path.join(__dirname, '../../../typescript/features/diagnostics');
console.log(root);

const {
    version: { major }
} = getPackageInfo('svelte', __dirname);
const newSvelteMajorExpected = `expected_svelte_${major}.json`;
const expectedTsGo = 'expected_tsgo.json';
const newSvelteMajorExpectedTsGo = `expected_tsgo_svelte_${major}.json`;

const capabilities: PublishDiagnosticsClientCapabilities = {
    tagSupport: {
        valueSet: [1]
    }
};

function createProvider(service: TsLSPService): DiagnosticsProvider {
    return {
        async getDiagnostics(document: Document) {
            const res = await service.sendRequest(DocumentDiagnosticRequest.type, {
                textDocument: { uri: document.uri }
            });
            if (res.kind !== 'full') {
                throw new Error('Unexpected response format');
            }
            return res.items.map((item) => ({
                range: item.range,
                severity: item.severity,
                source: item.source,
                message: addRelatedInfoIfIsMappingProgram(item),
                code: item.code,
                tags: item.tags ?? []
            }));
        },
        getDiagnosticsForPullMode() {
            throw new Error('Should not be called in this test');
        }
    };
    function addRelatedInfoIfIsMappingProgram(diagnostic: Diagnostic) {
        if (diagnostic.code === 100036) {
            return (
                diagnostic.message +
                (diagnostic.relatedInformation?.map((info) => info.message).join('\n') ?? '')
            );
        }
        return diagnostic.message;
    }
}

describe.only('diagnostics (content-mapper)', function () {
    const snapshotTester = createSnapshotTesterForTsGo(
        async (input, testOptions, services) => {
            const { service, docManager } = services;

            const document = docManager.openClientDocument({
                uri: pathToUrl(input),
                text: ts.sys.readFile(input) || ''
            });

            const provider = createProvider(service);

            await executeTest({
                provider: provider,
                document,
                dir: testOptions.dir,
                expected: existsSync(path.join(testOptions.dir, 'expected_tsgo.json'))
                    ? 'expected_tsgo.json'
                    : 'expectedv2.json'
            });
        },
        {
            textDocument: {
                publishDiagnostics: {
                    relatedInformation: true,
                    tagSupport: {
                        valueSet: [DiagnosticTag.Unnecessary, DiagnosticTag.Deprecated]
                    }
                }
            }
        }
    );

    snapshotTester({
        dir: path.join(root, 'fixtures'),
        context: this,
        workspaceDir: path.join(root, 'fixtures')
    });
});

async function executeTest({
    provider: service,
    document,
    dir,
    expected
}: {
    provider: DiagnosticsProvider;
    document: Document;
    dir: string;
    expected: string;
}) {
    const diagnostics = await service.getDiagnostics(document);

    const defaultExpectedFile = path.join(dir, expected);
    const expectedFileVariants = [
        path.join(dir, newSvelteMajorExpectedTsGo),
        path.join(dir, newSvelteMajorExpected),
        path.join(dir, expectedTsGo)
    ];
    const expectedFile = expectedFileVariants.find(existsSync) ?? defaultExpectedFile;
    const snapshotFormatter = await createJsonSnapshotFormatter(dir);

    await updateSnapshotIfFailedOrEmpty({
        assertion() {
            assert.deepStrictEqual(diagnostics, JSON.parse(readFileSync(expectedFile, 'utf-8')));
        },
        expectedFile,
        getFileContent() {
            return snapshotFormatter(diagnostics);
        },
        rootDir: root
    });
}
