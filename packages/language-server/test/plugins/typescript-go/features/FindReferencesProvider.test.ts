import path from 'path';
import { setupSharedServices, setupSkip } from '../test-utils';
import { FindReferencesProvider } from '../../../../src/plugins';
import { Position, ReferenceContext } from 'vscode-languageserver-types';
import { CancellationToken, ReferencesRequest } from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';
import ts from 'typescript';
import { findReferencesTest } from '../../typescript/features/FindReferencesProvider.test';

const testDir = path.join(__dirname, '../../typescript');
const testFilesDir = path.join(testDir, 'testfiles');

describe('FindReferencesProvider (TS GO)', function () {
    const getServices = setupSharedServices(testFilesDir);

    // Need to implement this in the future with client middleware
    const skips = [
        'finds references for $store',
        'can find component references from script tag',
        'can find all component references'
    ];
    findReferencesTest(setup, setupSkip(it, skips));

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getServices();
        const provider: FindReferencesProvider = {
            async findReferences(
                document: Document,
                position: Position,
                context: ReferenceContext,
                cancellationToken?: CancellationToken
            ) {
                const res = await service.sendRequest(
                    ReferencesRequest.type,
                    {
                        textDocument: {
                            uri: document.getURL()
                        },
                        position,
                        context
                    },
                    cancellationToken
                );

                if (document.getURL().includes('declaration-map')) {
                    // The only differences with the old result is the order of the references.
                    // Sort the result to match the old test expectations.
                    return res?.sort((a, b) => a.uri.localeCompare(b.uri)) ?? null;
                }

                return res;
            }
        };
        const document = openDoc(filename);
        return { provider, document, openDoc };

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
