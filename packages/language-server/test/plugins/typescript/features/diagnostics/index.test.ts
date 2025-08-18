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
    const workspaceDir = join(__dirname, 'fixtures');

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

            // Sanitize paths in diagnostic messages to use placeholder
            const sanitizedDiagnostics = diagnostics.map((d) => ({
                ...d,
                message: d.message?.replace(
                    /resolved to '[^']+\/test\/plugins\/typescript\/features\/diagnostics\/fixtures\//g,
                    "resolved to '<diagnosticsFixturePath>/"
                )
            }));

            // Check for version-specific expected file first
            const versionSpecificExpectedFile = join(
                fixturesDir,
                testPath,
                `expected_svelte_${svelteMajor}.json`
            );
            const defaultExpectedFile = join(fixturesDir, testPath, 'expectedv2.json');

            // Use version-specific file if it exists, otherwise use default
            const expectedFile = existsSync(versionSpecificExpectedFile)
                ? versionSpecificExpectedFile
                : defaultExpectedFile;

            const formatJson = await createJsonSnapshotFormatter(__dirname);

            // If UPDATE_SNAPSHOTS is true and we're on Svelte 5+, try the default first
            // Only create version-specific if it differs from default
            if (
                process.env.UPDATE_SNAPSHOTS === 'true' &&
                svelteMajor >= 5 &&
                !existsSync(versionSpecificExpectedFile)
            ) {
                try {
                    // Try with default file first
                    expect(sanitizedDiagnostics).toEqual(
                        JSON.parse(readFileSync(defaultExpectedFile, 'utf-8'))
                    );
                    // If it matches, we don't need a version-specific file
                } catch (e) {
                    // If it doesn't match, create version-specific file
                    await updateSnapshotIfFailedOrEmpty({
                        assertion: () =>
                            expect(sanitizedDiagnostics).toEqual(
                                JSON.parse(readFileSync(versionSpecificExpectedFile, 'utf-8'))
                            ),
                        expectedFile: versionSpecificExpectedFile,
                        rootDir: fixturesDir,
                        getFileContent: () => formatJson(sanitizedDiagnostics)
                    });
                    return;
                }
            }

            await updateSnapshotIfFailedOrEmpty({
                assertion: () =>
                    expect(sanitizedDiagnostics).toEqual(
                        JSON.parse(readFileSync(expectedFile, 'utf-8'))
                    ),
                expectedFile,
                rootDir: fixturesDir,
                getFileContent: () => formatJson(sanitizedDiagnostics)
            });
        });
    }
});
