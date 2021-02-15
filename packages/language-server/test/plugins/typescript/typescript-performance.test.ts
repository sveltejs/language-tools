import * as path from 'path';
import { performance } from 'perf_hooks';
import ts from 'typescript';
import { Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { TypeScriptPlugin } from '../../../src/plugins';
import { pathToUrl } from '../../../src/utils';

describe('TypeScript Plugin Performance Tests', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, 'testfiles');
        const filePath = path.join(testDir, filename);
        const uri = pathToUrl(filePath);
        const document = new Document(uri, ts.sys.readFile(filePath) || '');
        const pluginManager = new LSConfigManager();
        const plugin = new TypeScriptPlugin(docManager, pluginManager, [pathToUrl(testDir)]);
        docManager.openDocument({ uri, text: document.getText() });
        const updateDocument = (newText: string) =>
            docManager.updateDocument({ uri, version: 1 }, [
                { range: Range.create(Position.create(9, 0), Position.create(9, 0)), text: newText }
            ]);
        return { plugin, document, updateDocument };
    }

    it('should be fast enough', async () => {
        const { document, plugin, updateDocument } = setup('performance');

        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            await plugin.doHover(document, Position.create(1, 15));
            await plugin.getDiagnostics(document);
            await plugin.findReferences(document, Position.create(1, 15), {
                includeDeclaration: true
            });
            await plugin.getDocumentSymbols(document);
            await plugin.getSemanticTokens(document);
            await plugin.prepareRename(document, Position.create(1, 15));
            updateDocument('function asd() {}\n');
        }
        const end = performance.now();

        console.log(`Performance test took ${end - start}ms`);
    }).timeout(10000);
});
