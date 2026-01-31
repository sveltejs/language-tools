import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { Location } from 'vscode-languageserver-protocol';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../src/plugins';
import { TypeDefinitionProviderImpl } from '../../../../src/plugins/typescript/features/TypeDefinitionProvider';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');
const typeDefinitionTestDir = path.join(testDir, 'testfiles', 'typedefinition');

describe('TypeDefinitionProvider', function () {
    serviceWarmup(this, typeDefinitionTestDir, pathToUrl(testDir));

    function getFullPath(filename: string) {
        return path.join(typeDefinitionTestDir, filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const provider = new TypeDefinitionProviderImpl(lsAndTsDocResolver);
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { provider, document };
    }

    it('find type definition in TS file', async () => {
        const { document, provider } = setup('typedefinition.svelte');

        const typeDefs = await provider.getTypeDefinition(document, {
            line: 5,
            character: 15
        });

        assert.deepStrictEqual(typeDefs, <Location[]>[
            {
                range: {
                    start: {
                        line: 0,
                        character: 13
                    },
                    end: {
                        line: 0,
                        character: 30
                    }
                },
                uri: getUri('some-class.ts')
            }
        ]);
    });

    it('find type definition in same Svelte file', async () => {
        const { document, provider } = setup('typedefinition.svelte');

        const typeDefs = await provider.getTypeDefinition(document, {
            line: 6,
            character: 20
        });

        assert.deepStrictEqual(typeDefs, <Location[]>[
            {
                range: {
                    start: {
                        line: 3,
                        character: 10
                    },
                    end: {
                        line: 3,
                        character: 19
                    }
                },
                uri: getUri('typedefinition.svelte')
            }
        ]);
    });

    it('map definition of dts with declarationMap to source ', async () => {
        const { provider, document } = setup('../declaration-map/importing.svelte');

        const typeDefs = await provider.getTypeDefinition(document, { line: 1, character: 13 });
        assert.deepStrictEqual(typeDefs, <Location[]>[
            {
                range: {
                    end: { line: 0, character: 18 },
                    start: { line: 0, character: 16 }
                },
                uri: getUri('../declaration-map/declaration-map-project/index.ts')
            }
        ]);
    });
});
