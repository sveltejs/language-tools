import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager, TsInlayHintsConfig } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { InlayHintProviderImpl } from '../../../../../src/plugins/typescript/features/InlayHintProvider';
import { pathToUrl } from '../../../../../src/utils';
import {
    serviceWarmup,
    updateSnapshotIfFailedOrEmpty,
    createJsonSnapshotFormatter
} from '../../test-utils';
import { InlayHint } from 'vscode-languageserver-types';

function setup(workspaceDir: string, filePath: string) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    const allEnable: TsInlayHintsConfig = {
        enumMemberValues: { enabled: true },
        functionLikeReturnTypes: { enabled: true },
        parameterNames: { enabled: 'all', suppressWhenArgumentMatchesName: false },
        parameterTypes: { enabled: true },
        propertyDeclarationTypes: { enabled: true },
        variableTypes: { enabled: true, suppressWhenTypeMatchesName: false }
    };
    configManager.updateTsJsUserPreferences({
        typescript: {
            inlayHints: allEnable
        },
        javascript: {
            inlayHints: allEnable
        }
    });
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(workspaceDir)],
        configManager
    );
    const plugin = new InlayHintProviderImpl(lsAndTsDocResolver);
    const document = docManager.openClientDocument(<any>{
        uri: pathToUrl(filePath),
        text: ts.sys.readFile(filePath) || ''
    });
    return { plugin, document, docManager, lsAndTsDocResolver };
}

function sanitizeUri(inlayHints: InlayHint[] | null, workspaceUri: string) {
    if (!inlayHints) {
        return null;
    }

    return inlayHints.map((hint) => {
        const sanitized = { ...hint };
        if (Array.isArray(sanitized.label)) {
            sanitized.label = sanitized.label.map((label) => {
                if (label.location) {
                    const location = { ...label.location };
                    location.uri = location.uri.replace(workspaceUri, '<workspaceUri>');
                    const indexOfNodeModules = location.uri.lastIndexOf('node_modules');
                    if (indexOfNodeModules !== -1) {
                        location.uri =
                            '<node_modules>' +
                            location.uri.slice(indexOfNodeModules + 'node_modules'.length);
                    }
                    return { ...label, location };
                }
                return label;
            });
        }
        return sanitized;
    });
}

describe('InlayHintProvider', () => {
    const fixturesDir = join(__dirname, 'fixtures');
    const workspaceDir = join(__dirname, '../../testfiles');
    const workspaceUri = pathToUrl(workspaceDir);

    beforeAll(() => {
        serviceWarmup(workspaceDir, workspaceUri);
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

            const inlayHints = await plugin.getInlayHints(document, {
                start: { line: 0, character: 0 },
                end: document.positionAt(document.getTextLength())
            });

            // Sanitize URIs for consistent snapshots
            const sanitized = sanitizeUri(inlayHints, workspaceUri);

            // Compare against file-based expected output (expectedv2.json)
            const expectedFile = join(fixturesDir, testName, 'expectedv2.json');
            const formatJson = await createJsonSnapshotFormatter(__dirname);

            await updateSnapshotIfFailedOrEmpty({
                assertion: () =>
                    expect(sanitized).toEqual(
                        JSON.parse(readFileSync(expectedFile, 'utf-8'))
                    ),
                expectedFile,
                rootDir: fixturesDir,
                getFileContent: () => formatJson(sanitized)
            });
        });
    }
});
