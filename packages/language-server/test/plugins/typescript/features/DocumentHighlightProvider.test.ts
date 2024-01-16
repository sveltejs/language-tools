import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../src/plugins';
import { DocumentHighlightProviderImpl } from '../../../../src/plugins/typescript/features/DocumentHighlightProvider';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('DocumentHighlightProvider', () => {
    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'document-highlight', filename);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [testDir],
            new LSConfigManager()
        );
        const provider = new DocumentHighlightProviderImpl(lsAndTsDocResolver);
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { provider, document };
    }

    it('find document highlight', async () => {
        const { document, provider } = setup('document-highlight.svelte');

        const highlight = await provider.findDocumentHighlight(document, {
            line: 1,
            character: 9
        });

        assert.deepStrictEqual(highlight, <DocumentHighlight[]>[
            {
                range: {
                    start: {
                        line: 1,
                        character: 8
                    },
                    end: {
                        line: 1,
                        character: 12
                    }
                },
                kind: DocumentHighlightKind.Write
            },
            {
                range: {
                    start: {
                        line: 3,
                        character: 8
                    },
                    end: {
                        line: 3,
                        character: 12
                    }
                },
                kind: DocumentHighlightKind.Read
            },
            {
                range: {
                    start: {
                        line: 8,
                        character: 1
                    },
                    end: {
                        line: 8,
                        character: 5
                    }
                },
                kind: DocumentHighlightKind.Read
            }
        ]);
    });
});
