import assert from 'assert';
import { join } from 'path';
import sinon from 'sinon';
import ts from 'typescript';
import {
    Position,
    Range,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { UpdateImportsProviderImpl } from '../../../../src/plugins/typescript/features/UpdateImportsProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = join(__dirname, '..');
const testFilesDir = join(testDir, 'testfiles');

describe('UpdateImportsProviderImpl', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text),
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, testDir);
        const updateImportsProvider = new UpdateImportsProviderImpl(lsAndTsDocResolver);
        const filePath = join(testFilesDir, filename);
        const fileUri = pathToUrl(filePath);
        const document = docManager.openDocument(<any>{
            uri: fileUri,
            text: ts.sys.readFile(filePath) || '',
        });
        lsAndTsDocResolver.getLSAndTSDoc(document); // this makes sure ts ls knows the file
        return { updateImportsProvider, fileUri };
    }

    afterEach(() => sinon.restore());

    it('updates imports', async () => {
        const { updateImportsProvider, fileUri } = setup('updateimports.svelte');

        const workspaceEdit = await updateImportsProvider.updateImports({
            // imported files both old and new have to actually exist, so we just use some other test files
            oldUri: pathToUrl(join(testFilesDir, 'diagnostics.svelte')),
            newUri: pathToUrl(join(testFilesDir, 'documentation.svelte')),
        });

        assert.deepStrictEqual(workspaceEdit?.documentChanges, [
            TextDocumentEdit.create(VersionedTextDocumentIdentifier.create(fileUri, null), [
                TextEdit.replace(
                    Range.create(Position.create(1, 17), Position.create(1, 37)),
                    './documentation.svelte',
                ),
            ]),
        ]);
    });
});
