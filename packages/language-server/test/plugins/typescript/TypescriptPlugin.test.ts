import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { FileChangeType, Position } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../src/lib/documents';
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
        const projectJsFile =
            urlToPath(pathToUrl(path.join(path.dirname(filePath), 'documentation.ts'))) ?? '';

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
