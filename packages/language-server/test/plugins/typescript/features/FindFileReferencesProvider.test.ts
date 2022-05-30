import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Location, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FindFileReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindFileReferencesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

function test(useNewTransformation: boolean) {
    return () => {
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
            lsConfigManager.update({ svelte: { useNewTransformation } });
            const lsAndTsDocResolver = new LSAndTSDocResolver(
                docManager,
                [testDir],
                lsConfigManager
            );
            const provider = new FindFileReferencesProviderImpl(lsAndTsDocResolver);
            const document = openDoc(filename);
            return { provider, document };

            function openDoc(filename: string) {
                const filePath = getFullPath(filename);
                const doc = docManager.openDocument(<any>{
                    uri: pathToUrl(filePath),
                    text: ts.sys.readFile(filePath) || ''
                });
                return doc;
            }
        }

        async function test() {
            const { provider, document } = setup('find-file-references-child.svelte');
            loadAssociatedFiles();

            const results = await provider.fileReferences(document.uri.toString());
            const expectedResults = [
                Location.create(
                    getUri('find-file-references-parent.svelte'),
                    Range.create(Position.create(1, 37), Position.create(1, 72))
                )
            ];

            assert.deepStrictEqual(results, expectedResults);
        }

        //Make known all the associated files
        function loadAssociatedFiles() {
            setup('find-file-references-parent.svelte');
        }

        it('finds file references', async () => {
            await test();
        });
    };
}

describe('FindFileReferencesProvider', test(true));
