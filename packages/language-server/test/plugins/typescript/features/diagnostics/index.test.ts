import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { DiagnosticsProviderImpl } from '../../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { __resetCache } from '../../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../../src/utils';
import {
    serviceWarmup,
    updateSnapshotIfFailedOrEmpty,
    createJsonSnapshotFormatter
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
    version: { major: svelteMajor }
} = getPackageInfo('svelte', __dirname);
const isSvelte5 = svelteMajor >= 5;

describe('DiagnosticsProvider', () => {
    const fixturesDir = join(__dirname, 'fixtures');
    const workspaceDir = join(__dirname, '../../testfiles/diagnostics');

    beforeAll(() => {
        serviceWarmup(workspaceDir, pathToUrl(workspaceDir));
    });

    afterAll(() => {
        __resetCache();
    });

    // Recursively find all test directories with input.svelte
    function getTestDirs(dir: string, basePath = ''): string[] {
        const dirs: string[] = [];
        const entries = readdirSync(dir);

        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                const testPath = basePath ? `${basePath}/${entry}` : entry;
                const inputFile = join(fullPath, 'input.svelte');

                if (existsSync(inputFile)) {
                    // Skip .v5 tests if not on Svelte 5
                    if (entry.endsWith('.v5') && !isSvelte5) {
                        continue;
                    }
                    dirs.push(testPath);
                } else {
                    // Recurse into subdirectories
                    dirs.push(...getTestDirs(fullPath, testPath));
                }
            }
        }

        return dirs;
    }

    const testDirs = getTestDirs(fixturesDir);

    for (const testPath of testDirs) {
        it(testPath, async () => {
            const inputFile = join(fixturesDir, testPath, 'input.svelte');
            const { plugin, document } = setup(workspaceDir, inputFile);
            const diagnostics = await plugin.getDiagnostics(document);

            const expectedFile = join(fixturesDir, testPath, 'expectedv2.json');
            const formatJson = await createJsonSnapshotFormatter(__dirname);

            await updateSnapshotIfFailedOrEmpty({
                assertion: () =>
                    expect(diagnostics).toEqual(JSON.parse(readFileSync(expectedFile, 'utf-8'))),
                expectedFile,
                rootDir: fixturesDir,
                getFileContent: () => formatJson(diagnostics)
            });
        });
    }
});
