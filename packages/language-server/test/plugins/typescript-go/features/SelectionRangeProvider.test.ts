import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { Position, SelectionRange, SelectionRangeRequest } from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { SelectionRangeProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '../../typescript');
const selectionRangeTestDir = path.join(testDir, 'testfiles', 'selection-range');

describe('SelectionRangeProvider (TS GO)', function () {
    const getService = setupSharedServices(selectionRangeTestDir);

    function setup(fileName: string) {
        const { docManager, service } = getService();
        const filePath = path.join(testDir, 'testfiles', 'selection-range', fileName);
        const provider: SelectionRangeProvider = {
            getSelectionRange: async function (
                document: Document,
                position: Position
            ): Promise<SelectionRange | null> {
                const res = await service.sendRequest(SelectionRangeRequest.type, {
                    textDocument: { uri: document.uri },
                    positions: [position]
                });

                return res && res.length > 0 ? res[0] : null;
            }
        };
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath)
        });
        return { provider, document };
    }

    it('provides selection range', async () => {
        const { provider, document } = setup('selection-range.svelte');

        // ts 7 selection range doesn't work if the cursor after a identifier, like name|
        const selectionRange = await provider.getSelectionRange(document, Position.create(1, 8));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
                // let a;
                range: {
                    end: {
                        character: 10,
                        line: 1
                    },
                    start: {
                        character: 4,
                        line: 1
                    }
                }
            },
            // a
            range: {
                end: {
                    character: 9,
                    line: 1
                },
                start: {
                    character: 8,
                    line: 1
                }
            }
        });
    });

    // TODO: mostly likely because our import hoisting logic
    it.skip('provides selection range for import without semicolon', async () => {
        const { provider, document } = setup('selection-range-import.svelte');

        const selectionRange = await provider.getSelectionRange(document, Position.create(2, 28));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
                // this part is missing,
                parent: {
                    parent: {
                        parent: undefined,
                        range: {
                            end: {
                                character: 34,
                                line: 2
                            },
                            start: {
                                character: 4,
                                line: 1
                            }
                        }
                    },
                    // import {onMount} from 'svelte';
                    range: {
                        end: {
                            character: 34,
                            line: 2
                        },
                        start: {
                            character: 4,
                            line: 2
                        }
                    }
                },
                // 'svelte';
                range: {
                    end: {
                        character: 34,
                        line: 2
                    },
                    start: {
                        character: 26,
                        line: 2
                    }
                }
            },
            // svelte
            range: {
                end: {
                    character: 33,
                    line: 2
                },
                start: {
                    character: 27,
                    line: 2
                }
            }
        });
    });

    it('return null when in style', async () => {
        const { provider, document } = setup('selection-range.svelte');

        const selectionRange = await provider.getSelectionRange(document, Position.create(5, 0));

        assert.equal(selectionRange, null);
    });
});
