import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FindComponentReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindComponentReferencesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';
import { Location } from 'vscode-html-languageservice';
import { VERSION } from 'svelte/compiler';

const testDir = path.join(__dirname, '..', 'testfiles');
const isSvelte5Plus = +VERSION.split('.')[0] >= 5;

describe('FindComponentReferencesProvider', function () {
    serviceWarmup(this, testDir);

    function getFullPath(filename: string) {
        return path.join(testDir, filename);
    }
    function getUri(filename: string) {
        const filePath = path.join(testDir, filename);
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
        const provider = new FindComponentReferencesProviderImpl(lsAndTsDocResolver);
        const document = openDoc(filename);
        return { provider, document, openDoc, lsConfigManager };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openClientDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    it('finds component references', async () => {
        const { provider, document, openDoc } = setup('find-component-references-child.svelte');
        //Make known all the associated files
        openDoc('find-component-references-parent.svelte');
        openDoc('find-component-references-parent2.svelte');

        const results = await provider.findComponentReferences(document.uri.toString());

        const expected: Location[] = [
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
            expected.unshift({
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
        assert.deepStrictEqual(results, expected);
    });
});
