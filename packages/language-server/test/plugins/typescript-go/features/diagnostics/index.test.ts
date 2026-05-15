import path from 'path';
import { pathToUrl } from '../../../../../src/utils';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { VERSION } from 'svelte/compiler';
import { SvelteCheckTSGoDiagnosticsProvider } from '../../../../../src/plugins/typescript-go/features/DiagnosticsProvider';
import { describe } from 'mocha';
import { createJsonSnapshotFormatter, updateSnapshotIfFailedOrEmpty } from '../../../typescript/test-utils';
import { Document } from '../../../../../src/lib/documents';
import ts from 'typescript';
import { getPackageInfo } from '../../../../../src/importPackage';
import assert from 'assert';

const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

const root = path.join(__dirname, '../../../typescript/features/diagnostics');

const {
    version: { major }
} = getPackageInfo('svelte', __dirname);
const expected = 'expectedv2.json';
const newSvelteMajorExpected = `expected_svelte_${major}.json`;

describe.only('SvelteCheckTSGoDiagnosticsProvider', function () {
    const fixturesDir = path.join(root, 'fixtures');
    executeTests({
        dir: fixturesDir,
        workspaceDir: fixturesDir
    });
});

function executeTests(testOptions: { dir: string; workspaceDir: string }) {
    const { dir } = testOptions;

    const inputFile = path.join(dir, 'input.svelte');
    const getServices = setupSharedService(testOptions.workspaceDir);

    if (existsSync(inputFile)) {
        const _it =
            dir.endsWith('.v5') && !isSvelte5Plus ? it.skip : dir.endsWith('.only') ? it.only : it;
        _it(dir.substring(root.length), async () => {
            const services = getServices();
            await executeTest(inputFile, testOptions, services);
        });
    } else {
        const _describe = dir.endsWith('.only') ? describe.only : describe;
        _describe(dir.substring(root.length), function () {
            const subDirs = readdirSync(dir);

            for (const subDir of subDirs) {
                const stat = statSync(path.join(dir, subDir));
                if (stat.isDirectory()) {
                    executeTests({
                        ...testOptions,
                        dir: path.join(dir, subDir)
                    });
                }
            }
        });
    }
}

async function executeTest(
    inputFile: string,
    testOptions: { workspaceDir: string, dir: string },
    plugin: SvelteCheckTSGoDiagnosticsProvider
) {
    const { dir } = testOptions;
    const document = new Document(pathToUrl(inputFile), ts.sys.readFile(inputFile) || '');
    const diagnostics = await plugin.getDiagnostics(document);

    const defaultExpectedFile = path.join(dir, expected);
    const expectedFileForCurrentSvelteMajor = path.join(dir, newSvelteMajorExpected);
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

function setupSharedService(workspaceDir: string) {
    let service: SvelteCheckTSGoDiagnosticsProvider;
    before(async () => {
        const syncApi = await import('@typescript/native-preview/sync');
        const tsAst = await import('@typescript/native-preview/ast');
        console.log('Initializing SvelteCheckTSGoDiagnosticsProvider...');
        service = new SvelteCheckTSGoDiagnosticsProvider(
            syncApi,
            tsAst,
            path.join(workspaceDir, 'tsconfig.json'),
            'svelte2tsx'
        );
    });
    after(async () => {
        // service?.dispose();
    });

    return getServices;

    function getServices() {
        return service;
    }
}
