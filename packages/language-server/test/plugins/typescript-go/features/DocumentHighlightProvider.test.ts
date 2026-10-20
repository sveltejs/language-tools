import assert from 'assert';
import path from 'path';
import ts from 'typescript';
import {
    DocumentHighlight,
    DocumentHighlightKind,
    DocumentHighlightRequest
} from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { DocumentHighlightProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '../../typescript');

describe('DocumentHighlightProvider (TS GO)', function () {
    const highlightTestDir = path.join(testDir, 'testfiles', 'document-highlight');
    const getService = setupSharedServices(highlightTestDir);

    function getFullPath(filename: string) {
        return path.join(highlightTestDir, filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getService();
        const provider: DocumentHighlightProvider = {
            async findDocumentHighlight(
                document: Document,
                position: { line: number; character: number }
            ) {
                return service.sendRequest(DocumentHighlightRequest.type, {
                    textDocument: {
                        uri: document.getURL()
                    },
                    position
                });
            }
        };
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument({
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
