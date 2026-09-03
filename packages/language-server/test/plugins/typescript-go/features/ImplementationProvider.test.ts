import path from 'path';
import ts from 'typescript';
import { CancellationToken, ImplementationRequest } from 'vscode-languageserver';
import { Location, Position } from 'vscode-languageserver-types';
import { Document } from '../../../../src/lib/documents';
import { ImplementationProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { implementationTest } from '../../typescript/features/ImplemenationProvider.test';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '../../typescript');
const implementationTestDir = path.join(testDir, 'testfiles', 'implementation');

describe('ImplementationProvider (TS GO)', function () {
    const getServices = setupSharedServices(implementationTestDir);

    implementationTest(setup);

    function getFullPath(filename: string) {
        return path.join(implementationTestDir, filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getServices();
        const provider: ImplementationProvider = {
            async getImplementation(
                document: Document,
                position: Position,
                cancellationToken?: CancellationToken
            ) {
                const res = await service.sendRequest(
                    ImplementationRequest.type,
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
