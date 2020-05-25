import { DocumentManager, Document } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { CodeActionsProviderImpl } from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { pathToUrl } from '../../../../src/utils';
import ts from 'typescript';
import * as path from 'path';
import * as assert from 'assert';
import { Range, Position, CodeActionKind, TextDocumentEdit } from 'vscode-languageserver';

describe('CodeActionsProvider', () => {
    function getFullPath(filename: string) {
        return path.join(__dirname, '..', 'testfiles', filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }

    function harmonizeNewLines(input: string) {
        return input.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, ts.sys.newLine);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text),
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager);
        const provider = new CodeActionsProviderImpl(lsAndTsDocResolver);
        const filePath = getFullPath(filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || '',
        });
        return { provider, document, docManager };
    }

    it('provides quickfix', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(5, 4), Position.create(5, 5)),
            {
                diagnostics: [
                    {
                        code: 6133,
                        message: "'a' is declared but its value is never read.",
                        range: Range.create(Position.create(5, 4), Position.create(5, 5)),
                        source: 'ts',
                    },
                ],
                only: [CodeActionKind.QuickFix],
            },
        );

        assert.deepStrictEqual(codeActions, [
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 5,
                                        },
                                        end: {
                                            character: 0,
                                            line: 6,
                                        },
                                    },
                                },
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null,
                            },
                        },
                    ],
                },
                kind: CodeActionKind.QuickFix,
                title: "Remove unused declaration for: 'a'",
            },
        ]);
    })
        // initial build might take longer
        .timeout(8000);

    it('organizes imports', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)), // irrelevant
            {
                diagnostics: [],
                only: [CodeActionKind.SourceOrganizeImports],
            },
        );
        (<TextDocumentEdit>codeActions[0]?.edit?.documentChanges?.[0]).edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText)),
        );

        assert.deepStrictEqual(codeActions, [
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    // eslint-disable-next-line max-len
                                    newText: `import { A } from 'bla';${ts.sys.newLine}import { C } from 'blubb';${ts.sys.newLine}`,
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 1,
                                        },
                                        end: {
                                            character: 0,
                                            line: 2,
                                        },
                                    },
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 2,
                                        },
                                        end: {
                                            character: 0,
                                            line: 3,
                                        },
                                    },
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 3,
                                        },
                                        end: {
                                            character: 22,
                                            line: 3,
                                        },
                                    },
                                },
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null,
                            },
                        },
                    ],
                },
                kind: CodeActionKind.SourceOrganizeImports,
                title: 'Organize Imports',
            },
        ]);
    });
});
