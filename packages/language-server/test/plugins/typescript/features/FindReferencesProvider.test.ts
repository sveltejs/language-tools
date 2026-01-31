import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Location, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FindReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindReferencesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { __resetCache } from '../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';
import { FindComponentReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindComponentReferencesProvider';
import { VERSION } from 'svelte/compiler';

const testDir = path.join(__dirname, '..');
const isSvelte5Plus = +VERSION.split('.')[0] >= 5;

describe('FindReferencesProvider', function () {
    serviceWarmup(this, testDir);

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', filename);
    }
    function getUri(filename: string) {
        const filePath = path.join(testDir, 'testfiles', filename);
        return pathToUrl(filePath);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsConfigManager = new LSConfigManager();
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            lsConfigManager
        );
        const provider = new FindReferencesProviderImpl(
            lsAndTsDocResolver,
            new FindComponentReferencesProviderImpl(lsAndTsDocResolver)
        );
        const document = openDoc(filename);
        return { provider, document, openDoc };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openClientDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    async function test(position: Position, includeDeclaration: boolean) {
        const { provider, document } = setup('find-references.svelte');

        const results = await provider.findReferences(document, position, {
            includeDeclaration
        });

        let expectedResults = [
            Location.create(
                getUri('find-references.svelte'),
                Range.create(Position.create(2, 8), Position.create(2, 14))
            ),
            Location.create(
                getUri('find-references.svelte'),
                Range.create(Position.create(3, 8), Position.create(3, 14))
            )
        ];
        if (includeDeclaration) {
            expectedResults = [
                Location.create(
                    getUri('find-references.svelte'),
                    Range.create(Position.create(1, 10), Position.create(1, 16))
                )
            ].concat(expectedResults);
        }

        assert.deepStrictEqual(results, expectedResults);
    }

    it('finds references', async () => {
        await test(Position.create(1, 11), true);
    });

    it('finds references, excluding definition', async () => {
        await test(Position.create(1, 11), false);
    });

    it('finds references (not searching from declaration)', async () => {
        await test(Position.create(2, 8), true);
    });

    it('finds references for $store', async () => {
        const { provider, document, openDoc } = setup('find-references-$store.svelte');
        //Make known all the associated files
        openDoc('find-references-$store-other.svelte');

        const results = await provider.findReferences(document, Position.create(5, 10), {
            includeDeclaration: true
        });
        assert.deepStrictEqual(results, [
            {
                range: {
                    end: {
                        character: 19,
                        line: 1
                    },
                    start: {
                        character: 13,
                        line: 1
                    }
                },
                uri: getUri('find-references-$store-other.svelte')
            },
            {
                range: {
                    end: {
                        character: 15,
                        line: 2
                    },
                    start: {
                        character: 8,
                        line: 2
                    }
                },
                uri: getUri('find-references-$store-other.svelte')
            },
            {
                range: {
                    end: {
                        character: 15,
                        line: 3
                    },
                    start: {
                        character: 8,
                        line: 3
                    }
                },
                uri: getUri('find-references-$store-other.svelte')
            },
            {
                range: {
                    end: {
                        character: 8,
                        line: 7
                    },
                    start: {
                        character: 1,
                        line: 7
                    }
                },
                uri: getUri('find-references-$store-other.svelte')
            },
            {
                range: {
                    end: {
                        character: 23,
                        line: 1
                    },
                    start: {
                        character: 17,
                        line: 1
                    }
                },
                uri: getUri('find-references-$store.svelte')
            },
            {
                range: {
                    end: {
                        character: 15,
                        line: 5
                    },
                    start: {
                        character: 8,
                        line: 5
                    }
                },
                uri: getUri('find-references-$store.svelte')
            },
            {
                range: {
                    end: {
                        character: 15,
                        line: 6
                    },
                    start: {
                        character: 8,
                        line: 6
                    }
                },
                uri: getUri('find-references-$store.svelte')
            },
            {
                range: {
                    end: {
                        character: 8,
                        line: 10
                    },
                    start: {
                        character: 1,
                        line: 10
                    }
                },
                uri: getUri('find-references-$store.svelte')
            }
        ]);
    });

    it('ignores references inside generated code', async () => {
        const { provider, document } = setup('find-references-ignore-generated.svelte');

        const results = await provider.findReferences(document, Position.create(1, 8), {
            includeDeclaration: true
        });
        assert.deepStrictEqual(results, [
            {
                range: {
                    end: {
                        character: 9,
                        line: 1
                    },
                    start: {
                        character: 8,
                        line: 1
                    }
                },
                uri: getUri('find-references-ignore-generated.svelte')
            },
            {
                range: {
                    end: {
                        character: 6,
                        line: 5
                    },
                    start: {
                        character: 5,
                        line: 5
                    }
                },
                uri: getUri('find-references-ignore-generated.svelte')
            },
            {
                range: {
                    end: {
                        character: 21,
                        line: 7
                    },
                    start: {
                        character: 20,
                        line: 7
                    }
                },
                uri: getUri('find-references-ignore-generated.svelte')
            }
        ]);
    });

    it('ignores references inside generated TSX code', async () => {
        const file = 'find-references-ignore-generated-tsx.svelte';
        const uri = getUri(file);
        const { provider, document } = setup(file);

        const pos = Position.create(3, 15);
        const results = await provider.findReferences(document, pos, {
            includeDeclaration: true
        });

        assert.deepStrictEqual(results, [
            {
                uri,
                range: {
                    start: {
                        line: 1,
                        character: 13
                    },
                    end: {
                        line: 1,
                        character: 16
                    }
                }
            },
            {
                uri,
                range: {
                    start: {
                        line: 3,
                        character: 14
                    },
                    end: {
                        line: 3,
                        character: 17
                    }
                }
            },
            {
                uri,
                range: {
                    start: {
                        line: 7,
                        character: 4
                    },
                    end: {
                        line: 7,
                        character: 7
                    }
                }
            }
        ]);
    });

    it('map reference of dts with declarationMap to source ', async () => {
        const { provider, document } = setup('declaration-map/importing.svelte');

        const references = await provider.findReferences(
            document,
            { line: 1, character: 13 },
            {
                includeDeclaration: true
            }
        );
        assert.deepStrictEqual(references, <Location[]>[
            {
                range: {
                    end: { line: 0, character: 18 },
                    start: { line: 0, character: 16 }
                },
                uri: getUri('declaration-map/declaration-map-project/index.ts')
            },
            {
                range: {
                    end: { line: 1, character: 15 },
                    start: { line: 1, character: 13 }
                },
                uri: getUri('declaration-map/importing.svelte')
            }
        ]);
    });

    const componentReferences = [
        {
            range: {
                start: {
                    line: 1,
                    character: 9
                },
                end: {
                    line: 1,
                    character: 19
                }
            },
            uri: getUri('find-component-references-parent.svelte')
        },
        {
            range: {
                start: {
                    line: 18,
                    character: 1
                },
                end: {
                    line: 18,
                    character: 11
                }
            },
            uri: getUri('find-component-references-parent.svelte')
        },
        {
            range: {
                start: {
                    line: 20,
                    character: 1
                },
                end: {
                    line: 20,
                    character: 11
                }
            },
            uri: getUri('find-component-references-parent.svelte')
        },
        {
            range: {
                start: {
                    line: 1,
                    character: 9
                },
                end: {
                    line: 1,
                    character: 19
                }
            },
            uri: getUri('find-component-references-parent2.svelte')
        }
    ];
    if (!isSvelte5Plus) {
        componentReferences.unshift({
            range: {
                start: {
                    line: 8,
                    character: 15
                },
                end: {
                    line: 8,
                    character: 22
                }
            },
            uri: getUri('find-component-references-parent.svelte')
        });
    }

    it('can find component references from script tag', async () => {
        const { provider, document, openDoc } = setup('find-component-references-child.svelte');

        openDoc('find-component-references-parent.svelte');
        openDoc('find-component-references-parent2.svelte');

        const results = await provider.findReferences(document, Position.create(0, 1), {
            includeDeclaration: true
        });

        assert.deepStrictEqual(results, componentReferences);
    });

    it('can find all component references', async () => {
        const { provider, document, openDoc } = setup('find-component-references-parent.svelte');

        openDoc('find-component-references-parent2.svelte');

        const results = await provider.findReferences(document, Position.create(18, 1), {
            includeDeclaration: true
        });

        assert.deepStrictEqual(results, componentReferences);
    });

    // Hacky, but it works. Needed due to testing both new and old transformation
    after(() => {
        __resetCache();
    });
});
