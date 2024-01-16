import * as assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import {
    CancellationTokenSource,
    FileChangeType,
    LocationLink,
    Position,
    Range
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { LSAndTSDocResolver, TypeScriptPlugin } from '../../../src/plugins';
import { INITIAL_VERSION } from '../../../src/plugins/typescript/DocumentSnapshot';
import { __resetCache } from '../../../src/plugins/typescript/service';
import { ignoredBuildDirectories } from '../../../src/plugins/typescript/SnapshotManager';
import { pathToUrl } from '../../../src/utils';
import { serviceWarmup } from './test-utils';

const testDir = path.join(__dirname, 'testfiles');

describe('TypescriptPlugin', function () {
    serviceWarmup(this, testDir);

    function getUri(filename: string) {
        const filePath = path.join(__dirname, 'testfiles', filename);
        return pathToUrl(filePath);
    }

    function harmonizeNewLines(input: string) {
        return input.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, '\n');
    }

    function setup(filename: string) {
        const docManager = new DocumentManager((args) =>
            args.uri.includes('.svelte')
                ? new Document(args.uri, harmonizeNewLines(args.text))
                : document
        );
        const filePath = path.join(testDir, filename);
        const document = new Document(pathToUrl(filePath), ts.sys.readFile(filePath) || '');
        const lsConfigManager = new LSConfigManager();
        const workspaceUris = [pathToUrl(testDir)];
        const plugin = new TypeScriptPlugin(
            lsConfigManager,
            new LSAndTSDocResolver(docManager, [pathToUrl(testDir)], lsConfigManager),
            workspaceUris
        );
        docManager.openClientDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides document symbols', async () => {
        const { plugin, document } = setup('documentsymbols.svelte');
        let symbols = await plugin.getDocumentSymbols(document);
        symbols = symbols
            .map((s) => ({ ...s, name: harmonizeNewLines(s.name) }))
            .sort(
                (s1, s2) =>
                    s1.location.range.start.line * 100 +
                    s1.location.range.start.character -
                    (s2.location.range.start.line * 100 + s2.location.range.start.character)
            );

        assert.deepStrictEqual(symbols, [
            {
                name: 'bla',
                kind: 12,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 1,
                            character: 2
                        },
                        end: {
                            line: 3,
                            character: 3
                        }
                    }
                },
                containerName: 'render'
            },
            {
                name: 'hello',
                kind: 13,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 5,
                            character: 5
                        },
                        end: {
                            line: 5,
                            character: 14
                        }
                    }
                },
                containerName: 'render'
            },
            {
                name: "$: if (hello) {\n    console.log('hi');\n  }",
                kind: 12,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 6,
                            character: 1
                        },
                        end: {
                            line: 8,
                            character: 3
                        }
                    }
                },
                containerName: 'render'
            },
            {
                name: '$on("click") callback',
                kind: 12,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 12,
                            character: 39
                        },
                        end: {
                            line: 12,
                            character: 47
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'x',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 13,
                            character: 15
                        },
                        end: {
                            line: 13,
                            character: 16
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'b',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 13,
                            character: 21
                        },
                        end: {
                            line: 13,
                            character: 25
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'x',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 14,
                            character: 21
                        },
                        end: {
                            line: 14,
                            character: 22
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'b',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 14,
                            character: 27
                        },
                        end: {
                            line: 14,
                            character: 31
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'foo',
                kind: 13,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 16,
                            character: 17
                        },
                        end: {
                            line: 16,
                            character: 20
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'bar',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 17,
                            character: 10
                        },
                        end: {
                            line: 17,
                            character: 19
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'result',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 20,
                            character: 15
                        },
                        end: {
                            line: 20,
                            character: 21
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'bar',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 21,
                            character: 10
                        },
                        end: {
                            line: 21,
                            character: 22
                        }
                    }
                },
                containerName: '<function>'
            },
            {
                name: 'error',
                kind: 14,
                location: {
                    uri: getUri('documentsymbols.svelte'),
                    range: {
                        start: {
                            line: 23,
                            character: 8
                        },
                        end: {
                            line: 23,
                            character: 13
                        }
                    }
                },
                containerName: '<function>'
            }
        ]);
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
                Range.create(Position.create(7, 0), Position.create(7, 6))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(8, 7),
                Range.create(Position.create(8, 4), Position.create(8, 10))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(13, 3),
                Range.create(Position.create(13, 1), Position.create(13, 7))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(14, 7),
                Range.create(Position.create(14, 5), Position.create(14, 11))
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
                Range.create(Position.create(9, 0), Position.create(9, 6))
            );
        });

        it('(within script if)', async () => {
            await test$StoreDef(
                Position.create(10, 7),
                Range.create(Position.create(10, 4), Position.create(10, 10))
            );
        });

        it('(within template simple)', async () => {
            await test$StoreDef(
                Position.create(16, 3),
                Range.create(Position.create(16, 1), Position.create(16, 7))
            );
        });

        it('(within template if)', async () => {
            await test$StoreDef(
                Position.create(17, 7),
                Range.create(Position.create(17, 5), Position.create(17, 11))
            );
        });
    });

    it('map definition of dts with declarationMap to source ', async () => {
        const { plugin, document } = setup('declaration-map/importing.svelte');

        const definition = await plugin.getDefinitions(document, { line: 1, character: 13 });
        assert.deepStrictEqual(definition, [
            <LocationLink>{
                targetRange: {
                    end: { line: 0, character: 18 },
                    start: { line: 0, character: 16 }
                },
                targetSelectionRange: {
                    start: { line: 0, character: 16 },
                    end: { line: 0, character: 18 }
                },
                originSelectionRange: {
                    start: { line: 1, character: 13 },
                    end: { line: 1, character: 15 }
                },
                targetUri: getUri('declaration-map/declaration-map-project/index.ts')
            }
        ]);
    });

    it('map definition of dts with declarationMap (base64 data url) to source ', async () => {
        const { plugin, document } = setup('declaration-map/import-from-base64-sourcemap.svelte');

        const definition = await plugin.getDefinitions(document, { line: 1, character: 13 });
        assert.deepStrictEqual(definition, [
            <LocationLink>{
                targetRange: {
                    end: { line: 0, character: 18 },
                    start: { line: 0, character: 16 }
                },
                targetSelectionRange: {
                    start: { line: 0, character: 16 },
                    end: { line: 0, character: 18 }
                },
                originSelectionRange: {
                    start: { line: 1, character: 13 },
                    end: { line: 1, character: 15 }
                },
                targetUri: getUri('declaration-map/declaration-map-project/index.ts')
            }
        ]);
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

    it('should add declaration file snapshot when added to known build directory', async () => {
        await testForOnWatchedFileAdd(path.join('.svelte-kit', 'ambient.d.ts'), true);
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

    // Hacky, but it works. Needed due to testing both new and old transformation
    after(() => {
        __resetCache();
    });
});
