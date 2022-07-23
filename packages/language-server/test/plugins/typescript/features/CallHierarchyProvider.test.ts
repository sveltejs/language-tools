import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { CallHierarchyIncomingCall, CallHierarchyItem, SymbolKind } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { CallHierarchyProviderImpl } from '../../../../src/plugins/typescript/features/CallHierarchyProvicer';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { __resetCache } from '../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

function test(useNewTransformation: boolean) {
    const callHierarchyTestDirRelative = path.join('testfiles', 'call-hierarchy');

    return () => {
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
            lsConfigManager.update({ svelte: { useNewTransformation } });
            const lsAndTsDocResolver = new LSAndTSDocResolver(
                docManager,
                workspaceUris,
                lsConfigManager
            );
            const provider = new CallHierarchyProviderImpl(
                lsAndTsDocResolver,
                lsConfigManager,
                workspaceUris
            );
            const filePath = getFullPath(filename);
            const document = docManager.openDocument(<any>{
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

        const callHierarchyImportFileItem: CallHierarchyItem = {
            name: callHierarchyImportFileName,
            kind: SymbolKind.Class,
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
                    line: 12,
                    character: 24
                }
            },
            detail: callHierarchyTestDirRelative,
            uri: getUri(callHierarchyImportFileName)
        };

        it('can prepare call hierarchy', async () => {
            const { provider, document } = setup(callHierarchyImportFileName);

            const item = await provider.prepareCallHierarchy(document, { line: 9, character: 4 });

            assert.deepStrictEqual(item, [fooInImportItem]);
        });

        it('can prepare call hierarchy for imported file', async () => {
            const { provider, document } = setup(callHierarchyImportFileName);

            const item = await provider.prepareCallHierarchy(document, { line: 6, character: 8 });

            assert.deepStrictEqual(item, [
                <CallHierarchyItem>{
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
                }
            ]);
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
                                line: 4,
                                character: 9
                            }
                        },
                        kind: SymbolKind.Class,
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
                    from: callHierarchyImportFileItem,
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

        // Hacky, but it works. Needed due to testing both new and old transformation
        after(() => {
            __resetCache();
        });
    };
}

describe.only('CallHierarchyProvider (old transformation)', test(false));
describe.only('CallHierarchyProvider (new transformation)', test(true));
