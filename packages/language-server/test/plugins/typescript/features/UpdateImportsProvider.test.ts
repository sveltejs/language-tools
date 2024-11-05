import assert from 'assert';
import { join } from 'path';
import sinon from 'sinon';
import ts from 'typescript';
import {
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    TextDocumentEdit,
    TextEdit
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { UpdateImportsProviderImpl } from '../../../../src/plugins/typescript/features/UpdateImportsProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = join(__dirname, '..');
const updateImportTestDir = join(testDir, 'testfiles', 'update-imports');

describe('UpdateImportsProviderImpl', function () {
    serviceWarmup(this, updateImportTestDir, pathToUrl(testDir));

    async function setup(filename: string, useCaseSensitiveFileNames: boolean) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text),
            { useCaseSensitiveFileNames }
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager(),
            { tsSystem: { ...ts.sys, useCaseSensitiveFileNames } }
        );
        const updateImportsProvider = new UpdateImportsProviderImpl(
            lsAndTsDocResolver,
            useCaseSensitiveFileNames
        );
        const filePath = join(updateImportTestDir, filename);
        const fileUri = pathToUrl(filePath);
        const document = docManager.openClientDocument(<any>{
            uri: fileUri,
            text: ts.sys.readFile(filePath) || ''
        });
        await lsAndTsDocResolver.getLSAndTSDoc(document); // this makes sure ts ls knows the file
        return { updateImportsProvider, fileUri };
    }

    afterEach(() => sinon.restore());

    it('updates imports', async () => {
        const { updateImportsProvider, fileUri } = await setup(
            'updateimports.svelte',
            ts.sys.useCaseSensitiveFileNames
        );

        const workspaceEdit = await updateImportsProvider.updateImports({
            oldUri: pathToUrl(join(updateImportTestDir, 'imported.svelte')),
            newUri: pathToUrl(join(updateImportTestDir, 'documentation.svelte'))
        });

        assert.deepStrictEqual(workspaceEdit?.documentChanges, [
            TextDocumentEdit.create(OptionalVersionedTextDocumentIdentifier.create(fileUri, null), [
                TextEdit.replace(
                    Range.create(Position.create(1, 17), Position.create(1, 34)),
                    './documentation.svelte'
                )
            ])
        ]);
    });

    async function testUpdateForFileCasingChanges(useCaseSensitiveFileNames: boolean) {
        const { updateImportsProvider, fileUri } = await setup(
            'updateimports.svelte',
            useCaseSensitiveFileNames
        );

        const workspaceEdit = await updateImportsProvider.updateImports({
            oldUri: pathToUrl(join(updateImportTestDir, 'imported.svelte')),
            newUri: pathToUrl(join(updateImportTestDir, 'Imported.svelte'))
        });

        assert.deepStrictEqual(workspaceEdit?.documentChanges, [
            TextDocumentEdit.create(OptionalVersionedTextDocumentIdentifier.create(fileUri, null), [
                TextEdit.replace(
                    Range.create(Position.create(1, 17), Position.create(1, 34)),
                    './Imported.svelte'
                )
            ])
        ]);
    }

    it('updates imports for file casing changes (case-sensitive)', async () => {
        await testUpdateForFileCasingChanges(true);
    });

    it('updates imports for file casing changes (case-insensitive)', async () => {
        await testUpdateForFileCasingChanges(false);
    });
});
