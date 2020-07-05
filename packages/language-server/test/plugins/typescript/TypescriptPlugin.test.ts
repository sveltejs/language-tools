import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { FileChangeType, Hover, Position } from 'vscode-languageserver';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { TypeScriptPlugin } from '../../../src/plugins';
import { INITIAL_VERSION } from '../../../src/plugins/typescript/DocumentSnapshot';
import { pathToUrl, urlToPath } from '../../../src/utils';

describe('TypescriptPlugin', () => {
    function getUri(filename: string) {
        const filePath = path.join(__dirname, 'testfiles', filename);
        return pathToUrl(filePath);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, 'testfiles');
        const filePath = path.join(testDir, filename);
        const document = new Document(pathToUrl(filePath), ts.sys.readFile(filePath) || '');
        const pluginManager = new LSConfigManager();
        const plugin = new TypeScriptPlugin(docManager, pluginManager, testDir);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostics', async () => {
        const { plugin, document } = setup('diagnostics.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'true' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 32,
                        line: 0,
                    },
                    end: {
                        character: 35,
                        line: 0,
                    },
                },
                severity: 1,
                source: 'ts',
            },
        ]);
    });

    it('provides typecheck diagnostics for js file when //@ts-check at top of script', async () => {
        const { plugin, document } = setup('diagnostics-js-typecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2339,
                message: "Property 'bla' does not exist on type '1'.",
                range: {
                    start: {
                        character: 4,
                        line: 3,
                    },
                    end: {
                        character: 7,
                        line: 3,
                    },
                },
                severity: 1,
                source: 'js',
            },
        ]);
    });

    it('provides no typecheck diagnostics for js file', async () => {
        const { plugin, document } = setup('diagnostics-js-notypecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });

    it('provides diagnostics when there is a parser error', async () => {
        const { plugin, document } = setup('diagnostics-parsererror.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: -1,
                message: 'You can only have one top-level <style> tag per component',
                range: {
                    start: {
                        character: 0,
                        line: 1,
                    },
                    end: {
                        character: 0,
                        line: 1,
                    },
                },
                severity: 1,
                source: 'js',
            },
        ]);
    });

    it('provides basic hover info when no docstring exists', async () => {
        const { plugin, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await plugin.doHover(document, Position.create(4, 10)), <Hover>{
            contents: '```typescript\nconst withoutDocs: true\n```',
            range: {
                start: {
                    character: 10,
                    line: 4,
                },
                end: {
                    character: 21,
                    line: 4,
                },
            },
        });
    });

    it('provides formatted hover info when a docstring exists', async () => {
        const { plugin, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await plugin.doHover(document, Position.create(2, 10)), <Hover>{
            contents: '```typescript\nconst withDocs: true\n```\n---\nDocumentation string',
            range: {
                start: {
                    character: 10,
                    line: 2,
                },
                end: {
                    character: 18,
                    line: 2,
                },
            },
        });
    });

    it('provides document symbols', async () => {
        const { plugin, document } = setup('documentsymbols.svelte');
        const symbols = await plugin.getDocumentSymbols(document);

        assert.deepStrictEqual(
            symbols.find((symbol) => symbol.name === 'bla'),
            {
                containerName: 'render',
                kind: 12,
                location: {
                    range: {
                        start: {
                            character: 8,
                            line: 0,
                        },
                        end: {
                            character: 37,
                            line: 0,
                        },
                    },
                    uri: getUri('documentsymbols.svelte'),
                },
                name: 'bla',
            },
        );
    });

    it('provides definitions within svelte doc', async () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = await plugin.getDefinitions(document, Position.create(4, 1));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 0,
                        line: 4,
                    },
                    end: {
                        character: 3,
                        line: 4,
                    },
                },
                targetRange: {
                    start: {
                        character: 9,
                        line: 3,
                    },
                    end: {
                        character: 12,
                        line: 3,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 9,
                        line: 3,
                    },
                    end: {
                        character: 12,
                        line: 3,
                    },
                },
                targetUri: getUri('definitions.svelte'),
            },
        ]);
    });

    it('provides definitions from svelte to ts doc', async () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = await plugin.getDefinitions(document, Position.create(5, 1));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 0,
                        line: 5,
                    },
                    end: {
                        character: 5,
                        line: 5,
                    },
                },
                targetRange: {
                    start: {
                        character: 16,
                        line: 0,
                    },
                    end: {
                        character: 21,
                        line: 0,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 16,
                        line: 0,
                    },
                    end: {
                        character: 21,
                        line: 0,
                    },
                },
                targetUri: getUri('definitions.ts'),
            },
        ]);
    });

    it('provides definitions from svelte to svelte doc', async () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = await plugin.getDefinitions(document, Position.create(7, 3));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 1,
                        line: 7,
                    },
                    end: {
                        character: 13,
                        line: 7,
                    },
                },
                targetRange: {
                    start: {
                        character: 1,
                        line: 0,
                    },
                    end: {
                        character: 1,
                        line: 0,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 1,
                        line: 0,
                    },
                    end: {
                        character: 1,
                        line: 0,
                    },
                },
                targetUri: getUri('imported-file.svelte'),
            },
        ]);
    });

    const setupForOnWatchedFileChanges = () => {
        const { plugin, document } = setup('empty.svelte');
        const filePath = document.getFilePath()!;
        const snapshotManager = plugin.getSnapshotManager(filePath);

        // make it the same style of path delimiter as vscode's request
        const projectJsFile = urlToPath(
            pathToUrl(path.join(path.dirname(filePath), 'documentation.ts'))
        ) ?? '';

        plugin.onWatchFileChanges(projectJsFile, FileChangeType.Changed);

        return {
            snapshotManager,
            plugin,
            projectJsFile,
        };
    };

    it('bumps snapshot version when watched file changes', () => {
        const { snapshotManager, projectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        const firstVersion = firstSnapshot?.version;

        assert.notEqual(firstVersion, INITIAL_VERSION);

        plugin.onWatchFileChanges(projectJsFile, FileChangeType.Changed);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
    });

    it('should delete snapshot cache when file delete', () => {
        const { snapshotManager, projectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        assert.notEqual(firstSnapshot, undefined);

        plugin.onWatchFileChanges(projectJsFile, FileChangeType.Deleted);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.equal(secondSnapshot, undefined);
    });
});
