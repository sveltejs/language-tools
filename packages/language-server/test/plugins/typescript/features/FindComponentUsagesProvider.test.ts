import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FindComponentUsagesProviderImpl } from '../../../../src/plugins/typescript/features/FindComponentUsagesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('FindComponentUsagesProvider', () => {
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
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, [testDir], lsConfigManager);
        const provider = new FindComponentUsagesProviderImpl(lsAndTsDocResolver);
        const document = openDoc(filename);
        return { provider, document, openDoc };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    it('finds file references', async () => {
        const { provider, document, openDoc } = setup('find-component-usages-child.svelte');
        //Make known all the associated files
        openDoc('find-component-usages-parent.svelte');

        const results = await provider.findComponentUsages(document.uri.toString());

        assert.deepStrictEqual(results, [
            {
                range: {
                    end: {
                        character: 21,
                        line: 1
                    },
                    start: {
                        character: 11,
                        line: 1
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 14,
                        line: 18
                    },
                    start: {
                        character: 3,
                        line: 18
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 14,
                        line: 20
                    },
                    start: {
                        character: 3,
                        line: 20
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 20,
                        line: 5
                    },
                    start: {
                        character: 10,
                        line: 5
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 63,
                        line: 7
                    },
                    start: {
                        character: 57,
                        line: 7
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 16,
                        line: 8
                    },
                    start: {
                        character: 10,
                        line: 8
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            },
            {
                range: {
                    end: {
                        character: 21,
                        line: 14
                    },
                    start: {
                        character: 12,
                        line: 14
                    }
                },
                uri: getUri('find-component-usages-parent.svelte')
            }
        ]);
    }).timeout(3000);
});
