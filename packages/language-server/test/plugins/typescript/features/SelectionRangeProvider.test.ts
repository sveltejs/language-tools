import path from 'path';
import ts from 'typescript';
import assert from 'assert';
import { Position, SelectionRange } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { SelectionRangeProviderImpl } from '../../../../src/plugins/typescript/features/SelectionRangeProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { LSConfigManager } from '../../../../src/ls-config';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');
const selectionRangeTestDir = path.join(testDir, 'testfiles', 'selection-range');

describe('SelectionRangeProvider', function () {
    serviceWarmup(this, selectionRangeTestDir, pathToUrl(testDir));

    function setup(fileName: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const filePath = path.join(testDir, 'testfiles', 'selection-range', fileName);
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const provider = new SelectionRangeProviderImpl(lsAndTsDocResolver);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath)
        });
        return { provider, document };
    }

    it('provides selection range', async () => {
        const { provider, document } = setup('selection-range.svelte');

        const selectionRange = await provider.getSelectionRange(document, Position.create(1, 9));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
                parent: undefined,
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

    it('provides selection range for import without semicolon', async () => {
        const { provider, document } = setup('selection-range-import.svelte');

        const selectionRange = await provider.getSelectionRange(document, Position.create(2, 28));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
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
