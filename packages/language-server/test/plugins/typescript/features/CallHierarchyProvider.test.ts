import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    SymbolKind
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { CallHierarchyProviderImpl } from '../../../../src/plugins/typescript/features/CallHierarchyProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { __resetCache } from '../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';
import { VERSION } from 'svelte/compiler';

const testDir = path.join(__dirname, '..');
const isSvelte5Plus = +VERSION.split('.')[0] >= 5;

describe('CallHierarchyProvider', function () {
    const callHierarchyTestDirRelative = path.join('testfiles', 'call-hierarchy');
    serviceWarmup(this, path.join(testDir, callHierarchyTestDirRelative), pathToUrl(testDir));

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'call-hierarchy', filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }

    function harmonizeNewLines(input: string) {
        return input.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, '\n');
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsConfigManager = new LSConfigManager();
        const workspaceUris = [pathToUrl(testDir)];
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            workspaceUris,
            lsConfigManager
        );
        const provider = new CallHierarchyProviderImpl(lsAndTsDocResolver, workspaceUris);
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: harmonizeNewLines(ts.sys.readFile(filePath) || '')
        });
        return { provider, document, docManager };
    }

    const callHierarchyImportFileName = 'call-hierarchy-import.svelte';
    const fooInImportItem: CallHierarchyItem = {
        kind: SymbolKind.Function,
        name: 'foo',
        range: {
            start: {
                line: 5,
                character: 4
            },
            end: {
                line: 7,
                character: 5
            }
        },
        selectionRange: {
            start: {
                line: 5,
                character: 13
            },
            end: {
                line: 5,
                character: 16
            }
        },
        detail: undefined,
        tags: undefined,
        uri: getUri(callHierarchyImportFileName)
    };

    it('can prepare call hierarchy', async () => {
        const { provider, document } = setup(callHierarchyImportFileName);

        const item = await provider.prepareCallHierarchy(document, { line: 9, character: 4 });

        assert.deepStrictEqual(item, [fooInImportItem]);
    });

    const formatDateCallHierarchyItem: CallHierarchyItem = {
        kind: SymbolKind.Function,
        name: 'formatDate',
        range: {
            start: {
                line: 0,
                character: 0
            },
            end: {
                line: 0,
                character: 41
            }
        },
        selectionRange: {
            start: {
                line: 0,
                character: 16
            },
            end: {
                line: 0,
                character: 26
            }
        },
        detail: undefined,
        tags: undefined,
        uri: getUri('util.ts')
    };

    it('can prepare call hierarchy for imported file', async () => {
        const { provider, document } = setup(callHierarchyImportFileName);

        const item = await provider.prepareCallHierarchy(document, { line: 6, character: 8 });

        assert.deepStrictEqual(item, [formatDateCallHierarchyItem]);
    });

    it('can provide incoming calls', async () => {
        const { provider, document } = setup(callHierarchyImportFileName);

        const items = await provider.prepareCallHierarchy(document, { line: 6, character: 8 });
        const incoming = await provider.getIncomingCalls(items![0]);

        assert.deepStrictEqual(incoming, <CallHierarchyIncomingCall[]>[
            {
                from: {
                    kind: SymbolKind.Function,
                    name: 'formatDate2',
                    range: {
                        start: {
                            line: 2,
                            character: 0
                        },
                        end: {
                            line: 4,
                            character: 1
                        }
                    },
                    selectionRange: {
                        start: {
                            line: 2,
                            character: 16
                        },
                        end: {
                            line: 2,
                            character: 27
                        }
                    },
                    detail: undefined,
                    tags: undefined,
                    uri: getUri('util.ts')
                },
                fromRanges: [
                    {
                        end: {
                            character: 14,
                            line: 3
                        },
                        start: {
                            character: 4,
                            line: 3
                        }
                    }
                ]
            },
            {
                from: {
                    name: 'another-ref-format-date.svelte',
                    range: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 4,
                            character: 9
                        }
                    },
                    selectionRange: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 0,
                            character: 0
                        }
                    },
                    kind: SymbolKind.Module,
                    uri: getUri('another-ref-format-date.svelte'),
                    detail: callHierarchyTestDirRelative
                },
                fromRanges: [
                    {
                        start: {
                            line: 3,
                            character: 4
                        },
                        end: {
                            line: 3,
                            character: 14
                        }
                    }
                ]
            },
            {
                from: {
                    name: callHierarchyImportFileName,
                    kind: SymbolKind.Module,
                    range: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 12,
                            character: 24
                        }
                    },
                    selectionRange: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 0,
                            character: 0
                        }
                    },
                    detail: callHierarchyTestDirRelative,
                    uri: getUri(callHierarchyImportFileName)
                },
                fromRanges: [
                    {
                        start: {
                            line: 3,
                            character: 4
                        },
                        end: {
                            line: 3,
                            character: 14
                        }
                    },
                    {
                        start: {
                            line: 12,
                            character: 1
                        },
                        end: {
                            line: 12,
                            character: 11
                        }
                    }
                ]
            },
            {
                from: fooInImportItem,
                fromRanges: [
                    {
                        start: {
                            character: 8,
                            line: 6
                        },
                        end: {
                            character: 18,
                            line: 6
                        }
                    }
                ]
            }
        ]);
    });

    const outgoingComponentName = 'outgoing-component.svelte';

    it('can provide incoming calls for component file', async () => {
        const { provider, document } = setup('another-ref-format-date.svelte');

        const items = await provider.prepareCallHierarchy(document, { line: 0, character: 2 });
        const incoming = await provider.getIncomingCalls(items![0]);

        assert.deepStrictEqual(incoming, <CallHierarchyIncomingCall[]>[
            {
                from: {
                    detail: callHierarchyTestDirRelative,
                    kind: SymbolKind.Module,
                    name: outgoingComponentName,
                    range: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 10,
                            character: 24
                        }
                    },
                    selectionRange: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 0,
                            character: 0
                        }
                    },
                    uri: getUri(outgoingComponentName)
                },
                fromRanges: [
                    {
                        start: {
                            character: 1,
                            line: 10
                        },
                        end: {
                            character: 21,
                            line: 10
                        }
                    }
                ]
            }
        ]);
    });

    const outgoingComponentHiFunctionCall: CallHierarchyOutgoingCall = {
        to: {
            kind: SymbolKind.Function,
            name: 'log',
            range: {
                start: {
                    line: 7,
                    character: 4
                },
                end: {
                    line: 7,
                    character: 32
                }
            },
            selectionRange: {
                start: {
                    line: 7,
                    character: 13
                },
                end: {
                    line: 7,
                    character: 16
                }
            },
            detail: undefined,
            tags: undefined,
            uri: getUri(outgoingComponentName)
        },
        fromRanges: [
            {
                end: {
                    character: 11,
                    line: 4
                },
                start: {
                    character: 8,
                    line: 4
                }
            }
        ]
    };

    it('can provide outgoing calls', async () => {
        const { provider, document } = setup(outgoingComponentName);

        const items = await provider.prepareCallHierarchy(document, { line: 3, character: 14 });
        const incoming = await provider.getOutgoingCalls(items![0]);

        assert.deepStrictEqual(incoming, [outgoingComponentHiFunctionCall]);
    });

    it('can provide outgoing calls for component file', async () => {
        if (isSvelte5Plus) {
            // Doesn't work due to https://github.com/microsoft/TypeScript/issues/43740 and https://github.com/microsoft/TypeScript/issues/42375
            return;
        }

        const { provider, document } = setup(outgoingComponentName);

        const items = await provider.prepareCallHierarchy(document, { line: 10, character: 1 });
        const outgoing = await provider.getOutgoingCalls(items![0]);

        assert.deepStrictEqual(outgoing, <CallHierarchyOutgoingCall[]>[
            {
                to: formatDateCallHierarchyItem,
                fromRanges: [
                    {
                        end: {
                            character: 14,
                            line: 3
                        },
                        start: {
                            character: 4,
                            line: 3
                        }
                    }
                ]
            }
        ]);
    });

    it('can provide outgoing calls for component tags', async () => {
        if (isSvelte5Plus) {
            // Doesn't work due to https://github.com/microsoft/TypeScript/issues/43740 and https://github.com/microsoft/TypeScript/issues/42375
            return;
        }

        const { provider, document } = setup(outgoingComponentName);

        const items = await provider.prepareCallHierarchy(document, { line: 0, character: 2 });
        const outgoing = await provider.getOutgoingCalls(items![0]);

        assert.deepStrictEqual(outgoing, <CallHierarchyOutgoingCall[]>[
            {
                fromRanges: [
                    {
                        end: {
                            character: 21,
                            line: 10
                        },
                        start: {
                            character: 1,
                            line: 10
                        }
                    }
                ],
                to: {
                    detail: callHierarchyTestDirRelative,
                    kind: SymbolKind.Module,
                    name: 'another-ref-format-date.svelte',
                    uri: getUri('another-ref-format-date.svelte'),
                    range: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 4,
                            character: 9
                        }
                    },
                    selectionRange: {
                        start: {
                            line: 0,
                            character: 0
                        },
                        end: {
                            line: 0,
                            character: 0
                        }
                    }
                }
            }
        ]);
    });

    // Hacky, but it works. Needed due to testing both new and old transformation
    after(() => {
        __resetCache();
    });
});
