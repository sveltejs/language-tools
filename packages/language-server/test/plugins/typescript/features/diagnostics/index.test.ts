import * as assert from 'assert';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins';
import { DiagnosticsProviderImpl } from '../../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { pathToUrl } from '../../../../../src/utils';

function setup(workspaceDir: string, filePath: string) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(workspaceDir)],
        new LSConfigManager()
    );
    const plugin = new DiagnosticsProviderImpl(lsAndTsDocResolver);
    const document = docManager.openDocument(<any>{
        uri: pathToUrl(filePath),
        text: ts.sys.readFile(filePath) || ''
    });
    return { plugin, document, docManager, lsAndTsDocResolver };
}

function executeTests(dir: string, workspaceDir: string) {
    const inputFile = join(dir, 'input.svelte');
    if (existsSync(inputFile)) {
        const _it = dir.endsWith('.only') ? it.only : it;
        _it(dir.substring(__dirname.length), async () => {
            const { plugin, document } = setup(workspaceDir, inputFile);
            const diagnostics = await plugin.getDiagnostics(document);

            const expectedFile = join(dir, 'expected.json');
            if (existsSync(expectedFile)) {
                assert.deepStrictEqual(
                    diagnostics,
                    JSON.parse(readFileSync(expectedFile, 'UTF-8'))
                );
            } else {
                console.info('Created expected.json for ', dir.substring(__dirname.length));
                writeFileSync(expectedFile, JSON.stringify(diagnostics), 'UTF-8');
            }
        }).timeout(5000);
    } else {
        const _describe = dir.endsWith('.only') ? describe.only : describe;
        _describe(dir.substring(__dirname.length), () => {
            const subDirs = readdirSync(dir);

            for (const subDir of subDirs) {
                if (statSync(join(dir, subDir)).isDirectory()) {
                    executeTests(join(dir, subDir), workspaceDir);
                }
            }
        });
    }
}

describe('DiagnosticsProvider', () => {
    executeTests(join(__dirname, 'fixtures'), join(__dirname, 'fixtures'));
});
