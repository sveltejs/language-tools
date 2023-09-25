import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Location, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FindFileReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindFileReferencesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');

describe('FindFileReferencesProvider', function () {
    serviceWarmup(this, testDir);

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
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            lsConfigManager
        );
        const provider = new FindFileReferencesProviderImpl(lsAndTsDocResolver);
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

    it('finds file references', async function () {
        const { provider, document, openDoc } = setup('find-file-references-child.svelte');
        //Make known all the associated files
        openDoc('find-file-references-parent.svelte');

        const results = await provider.fileReferences(document.uri.toString());
        const expectedResults = [
            Location.create(
                getUri('find-file-references-parent.svelte'),
                Range.create(Position.create(1, 37), Position.create(1, 72))
            )
        ];

        assert.deepStrictEqual(results, expectedResults);
    });
});
