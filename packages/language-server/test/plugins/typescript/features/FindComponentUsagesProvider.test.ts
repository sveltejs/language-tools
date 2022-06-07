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

    function setup(filename: string, ignoreImports: boolean) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsConfigManager = new LSConfigManager();

        if (ignoreImports) {
            lsConfigManager.getConfig().typescript.findComponentUsagesIgnoresImports.enable = true;
        } else {
            lsConfigManager.getConfig().typescript.findComponentUsagesIgnoresImports.enable = false;
        }

        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, [testDir], lsConfigManager);
        const provider = new FindComponentUsagesProviderImpl(lsAndTsDocResolver);
        const document = openDoc(filename);
        return { provider, document, openDoc, lsConfigManager };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    it('finds component usages including imports', async () => {
        const { provider, document, openDoc } = setup('find-component-usages-child.svelte', false);
        //Make known all the associated files
        openDoc('find-component-usages-parent.svelte');

        const results = await provider.findComponentUsages(document);

        assert.deepStrictEqual(results, [
            {
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
                uri: getUri('find-component-usages-parent.svelte')
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
                uri: getUri('find-component-usages-parent.svelte')
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
                uri: getUri('find-component-usages-parent.svelte')
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
                uri: getUri('find-component-usages-parent.svelte')
            }
        ]);
    });

    it('finds component usages excluding imports', async () => {
        const { provider, document, openDoc } = setup('find-component-usages-child.svelte', true);
        //Make known all the associated files
        openDoc('find-component-usages-parent.svelte');

        const results = await provider.findComponentUsages(document);

        assert.deepStrictEqual(results, [
            {
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
                uri: getUri('find-component-usages-parent.svelte')
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
                uri: getUri('find-component-usages-parent.svelte')
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
                uri: getUri('find-component-usages-parent.svelte')
            }
        ]);
    });
});
