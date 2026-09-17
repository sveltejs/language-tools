import path from 'path';
import ts from 'typescript';
import { CancellationToken, TypeDefinitionRequest } from 'vscode-languageserver';
import { Location, Position } from 'vscode-languageserver-types';
import { Document } from '../../../../src/lib/documents';
import { TypeDefinitionProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { typeDefinitionTest } from '../../typescript/features/TypeDefinitionProvider.test';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '../../typescript');
const typeDefinitionTestDir = path.join(testDir, 'testfiles', 'typedefinition');

describe('TypeDefinitionProvider (TS GO)', function () {
    const getServices = setupSharedServices(testDir);

    typeDefinitionTest(setup);

    function getFullPath(filename: string) {
        return path.join(typeDefinitionTestDir, filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getServices();
        const provider: TypeDefinitionProvider = {
            async getTypeDefinition(
                document: Document,
                position: Position,
                cancellationToken?: CancellationToken
            ) {
                const res = await service.sendRequest(
                    TypeDefinitionRequest.type,
                    {
                        textDocument: {
                            uri: document.getURL()
                        },
                        position
                    },
                    cancellationToken
                );

                if (!res || !Array.isArray(res) || !res.every(Location.is)) {
                    throw new Error('Unexpected response format');
                }
                return res;
            }
        };
        const document = openDoc(filename);
        return { provider, document };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openClientDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }
});
