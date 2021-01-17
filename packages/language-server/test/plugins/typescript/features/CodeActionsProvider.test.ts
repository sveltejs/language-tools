import { DocumentManager, Document } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { CodeActionsProviderImpl } from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { pathToUrl } from '../../../../src/utils';
import ts from 'typescript';
import * as path from 'path';
import * as assert from 'assert';
import { Range, Position, CodeActionKind, TextDocumentEdit } from 'vscode-languageserver';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSConfigManager } from '../../../../src/ls-config';

const testDir = path.join(__dirname, '..');

describe('CodeActionsProvider', () => {
    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', filename);
    }

    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }

    function harmonizeNewLines(input: string) {
        return input.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, '\n');
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);
        const provider = new CodeActionsProviderImpl(lsAndTsDocResolver, completionProvider);
        const filePath = getFullPath(filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: harmonizeNewLines(ts.sys.readFile(filePath) || '')
        });
        return { provider, document, docManager };
    }

    it('provides quickfix', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(6, 4), Position.create(6, 5)),
            {
                diagnostics: [
                    {
                        code: 6133,
                        message: "'a' is declared but its value is never read.",
                        range: Range.create(Position.create(6, 4), Position.create(6, 5)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
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
                                            line: 6
                                        },
                                        end: {
                                            character: 0,
                                            line: 7
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: 0
                            }
                        }
                    ]
                },
                kind: CodeActionKind.QuickFix,
                title: "Remove unused declaration for: 'a'"
            }
        ]);
    });

    it('provides quickfix', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(6, 4), Position.create(6, 5)),
            {
                diagnostics: [
                    {
                        code: 6133,
                        message: "'a' is declared but its value is never read.",
                        range: Range.create(Position.create(6, 4), Position.create(6, 5)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
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
                                            line: 6
                                        },
                                        end: {
                                            character: 0,
                                            line: 7
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: 0
                            }
                        }
                    ]
                },
                kind: CodeActionKind.QuickFix,
                title: "Remove unused declaration for: 'a'"
            }
        ]);
    });

    it('organizes imports', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)), // irrelevant
            {
                diagnostics: [],
                only: [CodeActionKind.SourceOrganizeImports]
            }
        );
        (<TextDocumentEdit>codeActions[0]?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(codeActions, [
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    // eslint-disable-next-line max-len
                                    newText:
                                        "import { A } from 'bla';\nimport { C } from 'blubb';\n",
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 1
                                        },
                                        end: {
                                            character: 0,
                                            line: 2
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 2
                                        },
                                        end: {
                                            character: 0,
                                            line: 3
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 3
                                        },
                                        end: {
                                            character: 0,
                                            line: 4
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 4
                                        },
                                        end: {
                                            character: 20,
                                            line: 4
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: 0
                            }
                        }
                    ]
                },
                kind: CodeActionKind.SourceOrganizeImports,
                title: 'Organize Imports'
            }
        ]);
    });

    it('organizes imports with module script', async () => {
        const { provider, document } = setup('organize-imports-with-module.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)), // irrelevant
            {
                diagnostics: [],
                only: [CodeActionKind.SourceOrganizeImports]
            }
        );
        (<TextDocumentEdit>codeActions[0]?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(codeActions, [
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    // eslint-disable-next-line max-len
                                    newText: "import A from './A';\nimport { c } from './c';\n",
                                    range: {
                                        start: {
                                            line: 1,
                                            character: 2
                                        },
                                        end: {
                                            line: 2,
                                            character: 0
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            line: 6,
                                            character: 2
                                        },
                                        end: {
                                            line: 7,
                                            character: 2
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            line: 7,
                                            character: 2
                                        },
                                        end: {
                                            line: 7,
                                            character: 22
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-with-module.svelte'),
                                version: 0
                            }
                        }
                    ]
                },
                kind: CodeActionKind.SourceOrganizeImports,
                title: 'Organize Imports'
            }
        ]);
    });

    it('should do extract into const refactor', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const actions = await provider.getCodeActions(
            document,
            Range.create(Position.create(8, 8), Position.create(8, 42)),
            { diagnostics: [], only: [CodeActionKind.Refactor] }
        );
        const action = actions[1];

        assert.deepStrictEqual(action, {
            command: {
                arguments: [
                    getUri('codeactions.svelte'),
                    {
                        type: 'refactor',
                        refactorName: 'Extract Symbol',
                        originalRange: {
                            start: {
                                character: 8,
                                line: 8
                            },
                            end: {
                                character: 42,
                                line: 8
                            }
                        },
                        textRange: {
                            pos: 184,
                            end: 218
                        }
                    }
                ],
                command: 'constant_scope_0',
                title: 'Extract to constant in enclosing scope'
            },
            title: 'Extract to constant in enclosing scope'
        });

        const edit = await provider.executeCommand(
            document,
            action.command?.command || '',
            action.command?.arguments
        );

        (<TextDocumentEdit>edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            // eslint-disable-next-line max-len
                            newText: 'const newLocal=Math.random()>0.5? true:false;\n',
                            range: {
                                start: {
                                    character: 0,
                                    line: 8
                                },
                                end: {
                                    character: 0,
                                    line: 8
                                }
                            }
                        },
                        {
                            newText: 'newLocal',
                            range: {
                                start: {
                                    character: 8,
                                    line: 8
                                },
                                end: {
                                    character: 42,
                                    line: 8
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeactions.svelte'),
                        version: 0
                    }
                }
            ]
        });
    });

    it('should do extract into function refactor', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const actions = await provider.getCodeActions(
            document,
            Range.create(Position.create(8, 8), Position.create(8, 42)),
            { diagnostics: [], only: [CodeActionKind.Refactor] }
        );
        const action = actions[0];

        assert.deepStrictEqual(action, {
            command: {
                arguments: [
                    getUri('codeactions.svelte'),
                    {
                        type: 'refactor',
                        refactorName: 'Extract Symbol',
                        originalRange: {
                            start: {
                                character: 8,
                                line: 8
                            },
                            end: {
                                character: 42,
                                line: 8
                            }
                        },
                        textRange: {
                            pos: 184,
                            end: 218
                        }
                    }
                ],
                command: 'function_scope_0',
                title: "Extract to inner function in function 'render'"
            },
            title: 'Extract to function'
        });

        const edit = await provider.executeCommand(
            document,
            action.command?.command || '',
            action.command?.arguments
        );

        (<TextDocumentEdit>edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText: 'newFunction()',
                            range: {
                                start: {
                                    character: 8,
                                    line: 8
                                },
                                end: {
                                    character: 42,
                                    line: 8
                                }
                            }
                        },
                        {
                            newText:
                                '\n' +
                                '\n' +
                                'function newFunction() {' +
                                '\n' +
                                'return Math.random()>0.5? true:false;' +
                                '\n' +
                                '}' +
                                '\n',
                            range: {
                                start: {
                                    character: 0,
                                    line: 9
                                },
                                end: {
                                    character: 0,
                                    line: 9
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeactions.svelte'),
                        version: 0
                    }
                }
            ]
        });
    });
});
