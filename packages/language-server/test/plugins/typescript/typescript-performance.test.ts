import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { performance } from 'perf_hooks';
import ts from 'typescript';
import { Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { LSAndTSDocResolver, TypeScriptPlugin } from '../../../src/plugins';
import { pathToUrl } from '../../../src/utils';

describe.sequential('TypeScript Plugin Performance Tests', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, 'testfiles');
        const filePath = path.join(testDir, filename);
        const uri = pathToUrl(filePath);
        const document = new Document(uri, ts.sys.readFile(filePath) || '');
        const pluginManager = new LSConfigManager();
        const workspaceUris = [pathToUrl(testDir)];
        const plugin = new TypeScriptPlugin(
            pluginManager,
            new LSAndTSDocResolver(docManager, workspaceUris, pluginManager),
            workspaceUris,
            docManager
        );
        docManager.openClientDocument({ uri, text: document.getText() });
        const append = (newText: string) =>
            docManager.updateDocument({ uri, version: 1 }, [
                { range: Range.create(Position.create(9, 0), Position.create(9, 0)), text: newText }
            ]);
        const prepend = (newText: string) =>
            docManager.updateDocument({ uri, version: 1 }, [
                { range: Range.create(Position.create(1, 0), Position.create(1, 0)), text: newText }
            ]);
        return { plugin, document, append, prepend };
    }

    // Performance regression test that adapts to machine speed
    // Fast machines get stricter time limits, slow machines get more generous limits
    it.sequential('should be fast enough', async () => {
        const { document, plugin, append, prepend } = setup('performance.svelte');

        // Benchmark TypeScript compilation to establish machine baseline
        async function benchmark() {
            const start = performance.now();
            for (let i = 0; i < 5; i++) {
                ts.createProgram({
                    options: {},
                    rootNames: [document.getFilePath()!]
                });
            }
            return performance.now() - start;
        }

        const benchmarkElapse = Math.ceil(await benchmark());

        // Calculate adaptive time limit based on machine performance
        const expectedMaxTime = benchmarkElapse * 7;
        const maxAllowedTime = 25_000;
        const timeLimit = Math.min(expectedMaxTime, maxAllowedTime);

        console.log(
            `Benchmark took ${benchmarkElapse}ms. Expected operations to complete within ${timeLimit}ms`
        );

        // Run the actual performance test
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            const position = Position.create(Math.floor(i / 2) + 1, 15);
            await plugin.doHover(document, position);
            await plugin.getDiagnostics(document);
            await plugin.findReferences(document, position, {
                includeDeclaration: true
            });
            await plugin.getDocumentSymbols(document);
            await plugin.getSemanticTokens(document);
            await plugin.prepareRename(document, position);
            if (i % 2) {
                prepend('function asd() {}\n');
            } else {
                append('function asd() {}\n');
            }
        }
        const totalTime = performance.now() - start;
        console.log(`Performance test took ${totalTime}ms`);

        // Ensure operations complete within adaptive time limit
        expect(totalTime).toBeLessThan(timeLimit);
    });
});
