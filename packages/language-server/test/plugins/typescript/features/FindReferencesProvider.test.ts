import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Location, Position, Range } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { FindReferencesProviderImpl } from '../../../../src/plugins/typescript/features/FindReferencesProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('FindReferencesProvider', () => {
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
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, [testDir]);
        const provider = new FindReferencesProviderImpl(lsAndTsDocResolver);
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

    async function test(position: Position, includeDeclaration: boolean) {
        const { provider, document } = setup('find-references.svelte');

        const results = await provider.findReferences(document, position, { includeDeclaration });

        let expectedResults = [
            Location.create(
                getUri('find-references.svelte'),
                Range.create(Position.create(2, 8), Position.create(2, 14))
            ),
            Location.create(
                getUri('find-references.svelte'),
                Range.create(Position.create(3, 8), Position.create(3, 14))
            )
        ];
        if (includeDeclaration) {
            expectedResults = [
                Location.create(
                    getUri('find-references.svelte'),
                    Range.create(Position.create(1, 10), Position.create(1, 16))
                )
            ].concat(expectedResults);
        }

        assert.deepStrictEqual(results, expectedResults);
    }

    it('finds references', async () => {
        await test(Position.create(1, 11), true);
    });

    it('finds references, exluding definition', async () => {
        await test(Position.create(1, 11), false);
    });

    it('finds references (not searching from declaration)', async () => {
        await test(Position.create(2, 8), true);
    });
});
