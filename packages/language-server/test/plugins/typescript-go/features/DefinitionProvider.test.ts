import path from 'path';
import { DefinitionLink, DefinitionRequest, LocationLink, Position } from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { DefinitionsProvider } from '../../../../src/plugins';
import { setupSharedServices } from '../test-utils';
import ts from 'typescript';
import { pathToUrl } from '../../../../src/utils';
import assert from 'assert';
import { VERSION } from 'svelte/compiler';

const testDir = path.join(__dirname, '../../typescript', 'testfiles');

// Differences with the original test
// 1. Result targetRange. Our ts plugin returns the range of the identifier but the new ts lsp returns the full range of the declaration.
// 2. The range for component definition, old has length of 1 and the new one is 0.

describe('DefinitionProvider (TS GO)', function () {
    const getService = setupSharedServices(testDir, {
        capabilities: {
            textDocument: {
                definition: {
                    linkSupport: true
                }
            }
        }
    });

    function getFullPath(filename: string) {
        return path.join(testDir, filename);
    }

    function getUri(filename: string) {
        const filePath = path.join(testDir, filename);
        return pathToUrl(filePath);
    }

    function setup(fileName: string) {
        const { service, docManager } = getService();
        const plugin: DefinitionsProvider = {
            getDefinitions: async function (
                document: Document,
                position: Position
            ): Promise<DefinitionLink[]> {
                const res =
                    (await service.sendRequest(DefinitionRequest.type, {
                        textDocument: { uri: document.uri },
                        position
                    })) ?? [];
                if (!Array.isArray(res) || !res.every(LocationLink.is)) {
                    throw new Error('Unexpected response from DefinitionRequest');
                }

                return res;
            }
        };
        const path = getFullPath(fileName);
        const document = docManager.openClientDocument({
            uri: pathToUrl(path),
            text: ts.sys.readFile(path) || ''
        });
        return { plugin, document, docManager };
    }

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
                        character: 0,
                        line: 3
                    },
                    end: {
                        character: 29,
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
                        character: 0,
                        line: 0
                    },
                    end: {
                        character: 1,
                        line: 2
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
                        character: 0,
                        line: 0
                    },
                    end: {
                        character: 0,
                        line: 0
                    }
                },
                targetSelectionRange: {
                    start: {
                        character: 0,
                        line: 0
                    },
                    end: {
                        character: 0,
                        line: 0
                    }
                },
                targetUri: getUri('imported-file.svelte')
            }
        ]);
    });

    // TODO port and fix $store definition tests if possible.

    it('map definition of dts with declarationMap to source ', async () => {
        const { plugin, document } = setup('declaration-map/importing.svelte');

        const definition = await plugin.getDefinitions(document, { line: 1, character: 13 });
        assert.deepStrictEqual(definition, [
            <LocationLink>{
                targetRange: {
                    end: { line: 0, character: 23 },
                    start: { line: 0, character: 0 }
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
                    end: { line: 0, character: 23 },
                    start: { line: 0, character: 0 }
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

    const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;
    if (!isSvelte5Plus) {
        return;
    }

    it('provides definitions from svelte to rune-mode svelte doc', async () => {
        const { plugin, document } = setup('definition/definition-rune.svelte');

        const definitions = await plugin.getDefinitions(document, Position.create(4, 3));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 1,
                        line: 4
                    },
                    end: {
                        character: 13,
                        line: 4
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
                targetUri: getUri('definition/imported-rune.svelte')
            }
        ]);
    });
});
