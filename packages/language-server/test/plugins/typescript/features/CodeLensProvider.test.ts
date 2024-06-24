import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { CodeLensProviderImpl } from '../../../../src/plugins/typescript/features/CodeLensProvider';
import { FindComponentReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindComponentReferencesProvider';
import { FindReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindReferencesProvider';
import { ImplementationProviderImpl } from '../../../../src/plugins/typescript/features/ImplementationProvider';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');

describe('CodeLensProvider', function () {
    serviceWarmup(this, path.join(testDir, 'testfiles', 'codelens'), pathToUrl(testDir));

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'codelens', filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
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
        const componentReferencesProvider = new FindComponentReferencesProviderImpl(
            lsAndTsDocResolver
        );
        const referenceProvider = new FindReferencesProviderImpl(
            lsAndTsDocResolver,
            componentReferencesProvider
        );
        const implementationProvider = new ImplementationProviderImpl(lsAndTsDocResolver);
        const provider = new CodeLensProviderImpl(
            lsAndTsDocResolver,
            referenceProvider,
            implementationProvider,
            lsConfigManager
        );
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { provider, document, lsConfigManager };
    }

    it('provides reference codelens', async () => {
        const { provider, document, lsConfigManager } = setup('references.svelte');

        lsConfigManager.updateTsJsUserPreferences({
            typescript: { referencesCodeLens: { enabled: true } },
            javascript: {}
        });

        const codeLenses = await provider.getCodeLens(document);

        const references = codeLenses?.filter((lens) => lens.data.type === 'reference');

        assert.deepStrictEqual(references, [
            {
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 1 }
                },
                data: { type: 'reference', uri: getUri('references.svelte') }
            },
            {
                range: {
                    start: { line: 1, character: 14 },
                    end: { line: 1, character: 17 }
                },
                data: { type: 'reference', uri: getUri('references.svelte') }
            },
            {
                range: {
                    start: { line: 2, character: 8 },
                    end: { line: 2, character: 11 }
                },
                data: { type: 'reference', uri: getUri('references.svelte') }
            }
        ]);
    });

    it('resolve reference codelens', async () => {
        const { provider, document } = setup('references.svelte');
        const codeLens = await provider.resolveCodeLens(document, {
            range: {
                start: { line: 1, character: 14 },
                end: { line: 1, character: 17 }
            },
            data: { type: 'reference', uri: getUri('references.svelte') }
        });

        assert.deepStrictEqual(codeLens.command, {
            title: '1 reference',
            command: '',
            arguments: [
                getUri('references.svelte'),
                { line: 1, character: 14 },
                [
                    {
                        uri: getUri('references.svelte'),
                        range: {
                            start: { line: 5, character: 13 },
                            end: { line: 5, character: 16 }
                        }
                    }
                ]
            ]
        });
    });

    it('resolve component reference codelens', async () => {
        const { provider, document } = setup('references.svelte');
        const codeLens = await provider.resolveCodeLens(document, {
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 }
            },
            data: { type: 'reference', uri: getUri('references.svelte') }
        });

        assert.deepStrictEqual(codeLens.command, {
            title: '2 references',
            command: '',
            arguments: [
                getUri('references.svelte'),
                { line: 0, character: 0 },
                [
                    {
                        uri: getUri('importing.svelte'),
                        range: {
                            start: { line: 1, character: 11 },
                            end: { line: 1, character: 21 }
                        }
                    },
                    {
                        uri: getUri('importing.svelte'),
                        range: { start: { line: 4, character: 1 }, end: { line: 4, character: 11 } }
                    }
                ]
            ]
        });
    });

    it('provides implementation codelens', async () => {
        const { provider, document, lsConfigManager } = setup('references.svelte');

        lsConfigManager.updateTsJsUserPreferences({
            typescript: { implementationsCodeLens: { enabled: true } },
            javascript: {}
        });

        const codeLenses = await provider.getCodeLens(document);

        const references = codeLenses?.filter((lens) => lens.data.type === 'implementation');

        assert.deepStrictEqual(references, [
            {
                range: {
                    start: { line: 1, character: 14 },
                    end: { line: 1, character: 17 }
                },
                data: { type: 'implementation', uri: getUri('references.svelte') }
            }
        ]);
    });

    it('resolve implementation codelens', async () => {
        const { provider, document } = setup('references.svelte');
        const codeLens = await provider.resolveCodeLens(document, {
            range: {
                start: { line: 1, character: 14 },
                end: { line: 1, character: 17 }
            },
            data: { type: 'implementation', uri: getUri('references.svelte') }
        });

        assert.deepStrictEqual(codeLens.command, {
            title: '1 implementation',
            command: '',
            arguments: [
                getUri('references.svelte'),
                { line: 1, character: 14 },
                [
                    {
                        uri: getUri('references.svelte'),
                        range: {
                            start: { line: 5, character: 19 },
                            end: { line: 5, character: 33 }
                        }
                    }
                ]
            ]
        });
    });
});
