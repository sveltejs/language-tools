import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { WorkspaceSymbol } from 'vscode-languageserver-protocol';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../src/plugins';
import { WorkspaceSymbolsProviderImpl } from '../../../../src/plugins/typescript/features/WorkspaceSymbolProvider';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');

describe('WorkspaceSymbolsProvider', function () {
    serviceWarmup(this, testDir, pathToUrl(testDir));

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'workspace-symbols', filename);
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
        const provider = new WorkspaceSymbolsProviderImpl(lsAndTsDocResolver, lsConfigManager);
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath)
        });
        return { provider, document, docManager, lsAndTsDocResolver };
    }

    it('should return workspace symbols', async () => {
        const { provider, document, lsAndTsDocResolver } = setup('workspace-symbols.svelte');
        await lsAndTsDocResolver.getLSAndTSDoc(document);

        const symbols = await provider.getWorkspaceSymbols('longName');
        assert.deepStrictEqual(symbols, [
            {
                containerName: 'script',
                kind: 12,
                location: {
                    range: {
                        end: {
                            character: 5,
                            line: 3
                        },
                        start: {
                            character: 4,
                            line: 2
                        }
                    },
                    uri: getUri('workspace-symbols.svelte')
                },
                name: 'longLongName()',
                tags: undefined
            },
            {
                containerName: '',
                kind: 11,
                location: {
                    range: {
                        end: {
                            character: 1,
                            line: 5
                        },
                        start: {
                            character: 0,
                            line: 3
                        }
                    },
                    uri: getUri('imported.ts')
                },
                name: 'longLongName2',
                tags: [1]
            },
            {
                containerName: 'longLongName2',
                kind: 8,
                location: {
                    range: {
                        end: {
                            character: 26,
                            line: 4
                        },
                        start: {
                            character: 4,
                            line: 4
                        }
                    },
                    uri: getUri('imported.ts')
                },
                name: 'longLongName3',
                tags: undefined
            },
            {
                containerName: undefined,
                kind: 13,
                location: {
                    range: {
                        end: {
                            character: 28,
                            line: 8
                        },
                        start: {
                            character: 15,
                            line: 8
                        }
                    },
                    uri: getUri('workspace-symbols.svelte')
                },
                name: 'longLongName4',
                tags: undefined
            }
        ]);
    });

    it('filter out generated symbols', async () => {
        const { provider, document, lsAndTsDocResolver } = setup('workspace-symbols.svelte');
        await lsAndTsDocResolver.getLSAndTSDoc(document);

        const symbols = await provider.getWorkspaceSymbols('_');
        assert.deepStrictEqual(
            // Filter out the generated component class/const/type.
            // The unfiltered result is slightly different in svelte 4 and svelte 5,
            // and there is a maxResultCount limit, so it's not always present.
            onlyInWorkspaceSymbolsDir(symbols)?.filter(
                (v) => v.name !== 'WorkspaceSymbols__SvelteComponent_'
            ),
            []
        );

        const symbols2 = await provider.getWorkspaceSymbols('$');
        assert.deepStrictEqual(onlyInWorkspaceSymbolsDir(symbols2), []);
    });

    function onlyInWorkspaceSymbolsDir(symbols: WorkspaceSymbol[] | null) {
        return symbols?.filter((f) => f.location.uri.includes('workspace-symbols'));
    }
});
