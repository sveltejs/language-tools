import * as assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { CancellationTokenSource, FileChangeType, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { LSAndTSDocResolver, TypeScriptPlugin } from '../../../src/plugins';
import { INITIAL_VERSION } from '../../../src/plugins/typescript/DocumentSnapshot';
import { ignoredBuildDirectories } from '../../../src/plugins/typescript/SnapshotManager';
import { pathToUrl } from '../../../src/utils';

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
        const plugin = new TypeScriptPlugin(
            pluginManager,
            new LSAndTSDocResolver(docManager, [pathToUrl(testDir)], pluginManager)
        );
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

    it('can cancel document symbols before promise resolved', async () => {
        const { plugin, document } = setup('documentsymbols.svelte');
        const cancellationTokenSource = new CancellationTokenSource();
        const symbolsPromise = plugin.getDocumentSymbols(document, cancellationTokenSource.token);

        cancellationTokenSource.cancel();
        assert.deepStrictEqual(await symbolsPromise, []);
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
                Range.create(Position.create(7, 1), Position.create(7, 6))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(8, 7),
                Range.create(Position.create(8, 5), Position.create(8, 10))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(13, 3),
                Range.create(Position.create(13, 2), Position.create(13, 7))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(14, 7),
                Range.create(Position.create(14, 6), Position.create(14, 11))
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
                Range.create(Position.create(9, 1), Position.create(9, 6))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(10, 7),
                Range.create(Position.create(10, 5), Position.create(10, 10))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(16, 3),
                Range.create(Position.create(16, 2), Position.create(16, 7))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(17, 7),
                Range.create(Position.create(17, 6), Position.create(17, 11))
            );
        });
    });

    const setupForOnWatchedFileChanges = async () => {
        const { plugin, document } = setup('empty.svelte');
        const targetSvelteFile = document.getFilePath()!;
        const snapshotManager = await plugin.getSnapshotManager(targetSvelteFile);

        return {
            snapshotManager,
            plugin,
            targetSvelteFile
        };
    };

    const setupForOnWatchedFileUpdateOrDelete = async () => {
        const { plugin, snapshotManager, targetSvelteFile } = await setupForOnWatchedFileChanges();

        const projectJsFile = path.join(path.dirname(targetSvelteFile), 'documentation.ts');
        await plugin.onWatchFileChanges([
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

    it('bumps snapshot version when watched file changes', async () => {
        const { snapshotManager, projectJsFile, plugin } =
            await setupForOnWatchedFileUpdateOrDelete();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        const firstVersion = firstSnapshot?.version;

        assert.notEqual(firstVersion, INITIAL_VERSION);

        await plugin.onWatchFileChanges([
            {
                fileName: projectJsFile,
                changeType: FileChangeType.Changed
            }
        ]);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
    });

    it('should delete snapshot cache when file delete', async () => {
        const { snapshotManager, projectJsFile, plugin } =
            await setupForOnWatchedFileUpdateOrDelete();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        assert.notEqual(firstSnapshot, undefined);

        await plugin.onWatchFileChanges([
            {
                fileName: projectJsFile,
                changeType: FileChangeType.Deleted
            }
        ]);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.equal(secondSnapshot, undefined);
    });

    const testForOnWatchedFileAdd = async (filePath: string, shouldExist: boolean) => {
        const { snapshotManager, plugin, targetSvelteFile } = await setupForOnWatchedFileChanges();
        const addFile = path.join(path.dirname(targetSvelteFile), filePath);

        const dir = path.dirname(addFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(addFile, 'export function abc() {}');
        assert.ok(fs.existsSync(addFile));

        try {
            assert.equal(snapshotManager.has(addFile), false);

            await plugin.onWatchFileChanges([
                {
                    fileName: addFile,
                    changeType: FileChangeType.Created
                }
            ]);

            assert.equal(snapshotManager.has(addFile), shouldExist);

            await plugin.onWatchFileChanges([
                {
                    fileName: addFile,
                    changeType: FileChangeType.Changed
                }
            ]);

            assert.equal(snapshotManager.has(addFile), shouldExist);
        } finally {
            fs.unlinkSync(addFile);
        }
    };

    it('should add snapshot when a project file is added', async () => {
        await testForOnWatchedFileAdd('foo.ts', true);
    });

    it('should not add snapshot when an excluded file is added', async () => {
        await testForOnWatchedFileAdd(path.join('dist', 'index.js'), false);
    });

    it('should not add snapshot when files added to known build directory', async () => {
        for (const dir of ignoredBuildDirectories) {
            await testForOnWatchedFileAdd(path.join(dir, 'index.js'), false);
        }
    });

    it('should update ts/js file after document change', async () => {
        const { snapshotManager, projectJsFile, plugin } =
            await setupForOnWatchedFileUpdateOrDelete();

        const firstSnapshot = snapshotManager.get(projectJsFile);
        const firstVersion = firstSnapshot?.version;
        const firstText = firstSnapshot?.getText(0, firstSnapshot?.getLength());

        assert.notEqual(firstVersion, INITIAL_VERSION);

        await plugin.updateTsOrJsFile(projectJsFile, [
            {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                text: 'const = "hello world";'
            }
        ]);
        const secondSnapshot = snapshotManager.get(projectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
        assert.equal(
            secondSnapshot?.getText(0, secondSnapshot?.getLength()),
            'const = "hello world";' + firstText
        );
    });
});
