import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import fs from 'fs';
import { FileChangeType, Position, Range } from 'vscode-languageserver';
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

    function harmonizeNewLines(input: string) {
        return input.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, '\n');
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, 'testfiles');
        const filePath = path.join(testDir, filename);
        const document = new Document(pathToUrl(filePath), ts.sys.readFile(filePath) || '');
        const pluginManager = new LSConfigManager();
        const plugin = new TypeScriptPlugin(docManager, pluginManager, [pathToUrl(testDir)]);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides document symbols', async () => {
        const { plugin, document } = setup('documentsymbols.svelte');
        const symbols = await plugin.getDocumentSymbols(document);

        assert.deepStrictEqual(
            symbols.map((s) => ({ ...s, name: harmonizeNewLines(s.name) })),
            [
                {
                    containerName: 'render',
                    kind: 12,
                    location: {
                        range: {
                            start: {
                                line: 6,
                                character: 3
                            },
                            end: {
                                line: 8,
                                character: 5
                            }
                        },
                        uri: getUri('documentsymbols.svelte')
                    },
                    name: "$: if (hello) {\n        console.log('hi');\n    }"
                },
                {
                    containerName: 'render',
                    kind: 12,
                    location: {
                        range: {
                            start: {
                                line: 1,
                                character: 4
                            },
                            end: {
                                line: 3,
                                character: 5
                            }
                        },
                        uri: getUri('documentsymbols.svelte')
                    },
                    name: 'bla'
                },
                {
                    containerName: 'render',
                    kind: 13,
                    location: {
                        range: {
                            start: {
                                line: 5,
                                character: 7
                            },
                            end: {
                                line: 5,
                                character: 16
                            }
                        },
                        uri: getUri('documentsymbols.svelte')
                    },
                    name: 'hello'
                }
            ]
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
                        line: 4
                    },
                    end: {
                        character: 3,
                        line: 4
                    }
                },
                targetRange: {
                    start: {
                        character: 9,
                        line: 3
                    },
                    end: {
                        character: 12,
                        line: 3
                    }
                },
                targetSelectionRange: {
                    start: {
                        character: 9,
                        line: 3
                    },
                    end: {
                        character: 12,
                        line: 3
                    }
                },
                targetUri: getUri('definitions.svelte')
            }
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
                        line: 5
                    },
                    end: {
                        character: 5,
                        line: 5
                    }
                },
                targetRange: {
                    start: {
                        character: 16,
                        line: 0
                    },
                    end: {
                        character: 21,
                        line: 0
                    }
                },
                targetSelectionRange: {
                    start: {
                        character: 16,
                        line: 0
                    },
                    end: {
                        character: 21,
                        line: 0
                    }
                },
                targetUri: getUri('definitions.ts')
            }
        ]);
    });

    it('provides definitions from svelte to svelte doc', async () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = await plugin.getDefinitions(document, Position.create(12, 3));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 1,
                        line: 12
                    },
                    end: {
                        character: 13,
                        line: 12
                    }
                },
                targetRange: {
                    start: {
                        character: 1,
                        line: 0
                    },
                    end: {
                        character: 1,
                        line: 0
                    }
                },
                targetSelectionRange: {
                    start: {
                        character: 1,
                        line: 0
                    },
                    end: {
                        character: 1,
                        line: 0
                    }
                },
                targetUri: getUri('imported-file.svelte')
            }
        ]);
    });

    describe('provides definitions for $store within svelte file', () => {
        async function test$StoreDef(pos: Position, originSelectionRange: Range) {
            const { plugin, document } = setup('definitions.svelte');

            const definitions = await plugin.getDefinitions(document, pos);

            assert.deepStrictEqual(definitions, [
                {
                    originSelectionRange,
                    targetRange: {
                        start: {
                            character: 4,
                            line: 6
                        },
                        end: {
                            character: 9,
                            line: 6
                        }
                    },
                    targetSelectionRange: {
                        start: {
                            character: 4,
                            line: 6
                        },
                        end: {
                            character: 9,
                            line: 6
                        }
                    },
                    targetUri: getUri('definitions.svelte')
                }
            ]);
        }

        it('(within script simple)', async () => {
            await test$StoreDef(
                Position.create(7, 1),
                Range.create(Position.create(7, 1), Position.create(7, 5))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(8, 7),
                Range.create(Position.create(8, 5), Position.create(8, 9))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(13, 3),
                Range.create(Position.create(13, 2), Position.create(13, 6))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(14, 7),
                Range.create(Position.create(14, 6), Position.create(14, 10))
            );
        });
    });

    describe('provides definitions for $store from svelte file to ts file', () => {
        async function test$StoreDef(pos: Position, originSelectionRange: Range) {
            const { plugin, document } = setup('definitions.svelte');

            const definitions = await plugin.getDefinitions(document, pos);

            assert.deepStrictEqual(definitions, [
                {
                    originSelectionRange,
                    targetRange: {
                        start: {
                            character: 16,
                            line: 0
                        },
                        end: {
                            character: 21,
                            line: 0
                        }
                    },
                    targetSelectionRange: {
                        start: {
                            character: 16,
                            line: 0
                        },
                        end: {
                            character: 21,
                            line: 0
                        }
                    },
                    targetUri: getUri('definitions.ts')
                }
            ]);
        }

        it('(within script simple)', async () => {
            await test$StoreDef(
                Position.create(9, 1),
                Range.create(Position.create(9, 1), Position.create(9, 5))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(10, 7),
                Range.create(Position.create(10, 5), Position.create(10, 9))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(16, 3),
                Range.create(Position.create(16, 2), Position.create(16, 6))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(17, 7),
                Range.create(Position.create(17, 6), Position.create(17, 10))
            );
        });
    });

    const setupForOnWatchedFileChanges = () => {
        const { plugin, document } = setup('empty.svelte');
        const targetSvelteFile = document.getFilePath()!;
        const snapshotManager = plugin.getSnapshotManager(targetSvelteFile);

        return {
            snapshotManager,
            plugin,
            targetSvelteFile
        };
    };

    /**
     *  make it the same style of path delimiter as vscode's request
     */
    const normalizeWatchFilePath = (path: string) => {
        return urlToPath(pathToUrl(path)) ?? '';
    };

    const setupForOnWatchedFileUpdateOrDelete = () => {
        const { plugin, snapshotManager, targetSvelteFile } = setupForOnWatchedFileChanges();

        const projectJsFile = normalizeWatchFilePath(
            path.join(path.dirname(targetSvelteFile), 'documentation.ts')
        );

        plugin.onWatchFileChanges([
            {
                fileName: projectJsFile,
                changeType: FileChangeType.Changed
            }
        ]);

        return {
            snapshotManager,
            plugin,
            projectJsFile
        };
    };

    it('bumps snapshot version when watched file changes', () => {
        const { snapshotManager, projectJsFile, plugin } = setupForOnWatchedFileUpdateOrDelete();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        const firstVersion = firstSnapshot?.version;

        assert.notEqual(firstVersion, INITIAL_VERSION);

        plugin.onWatchFileChanges([
            {
                fileName: projectJsFile,
                changeType: FileChangeType.Changed
            }
        ]);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
    });

    it('should delete snapshot cache when file delete', () => {
        const { snapshotManager, projectJsFile, plugin } = setupForOnWatchedFileUpdateOrDelete();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        assert.notEqual(firstSnapshot, undefined);

        plugin.onWatchFileChanges([
            {
                fileName: projectJsFile,
                changeType: FileChangeType.Deleted
            }
        ]);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.equal(secondSnapshot, undefined);
    });

    it('should add snapshot when project file added', () => {
        const { snapshotManager, plugin, targetSvelteFile } = setupForOnWatchedFileChanges();
        const addFile = path.join(path.dirname(targetSvelteFile), 'foo.ts');
        const normalizedAddFilePath = normalizeWatchFilePath(addFile);

        try {
            fs.writeFileSync(addFile, 'export function abc() {}');
            assert.equal(snapshotManager.has(normalizedAddFilePath), false);

            plugin.onWatchFileChanges([
                {
                    fileName: normalizedAddFilePath,
                    changeType: FileChangeType.Created
                }
            ]);

            assert.equal(snapshotManager.has(normalizedAddFilePath), true);
        } finally {
            fs.unlinkSync(addFile);
        }
    });
});
