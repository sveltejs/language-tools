import { DocumentManager, Document } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { CodeActionsProviderImpl } from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { pathToUrl } from '../../../../src/utils';
import ts from 'typescript';
import * as path from 'path';
import * as assert from 'assert';
import {
    Range,
    Position,
    CodeActionKind,
    TextDocumentEdit,
    CodeAction,
    CancellationTokenSource
} from 'vscode-languageserver';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSConfigManager } from '../../../../src/ls-config';

const testDir = path.join(__dirname, '..');

describe('CodeActionsProvider', () => {
    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'code-actions', filename);
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
                                version: null
                            }
                        }
                    ]
                },
                kind: CodeActionKind.QuickFix,
                title: "Remove unused declaration for: 'a'"
            }
        ]);
    });

    it('provides quickfix for missing function', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(9, 0), Position.create(9, 3)),
            {
                diagnostics: [
                    {
                        code: 2304,
                        message: "Cannot find name 'abc'.",
                        range: Range.create(Position.create(9, 0), Position.create(9, 3)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        );

        testFixMissingFunctionQuickFix(codeActions);
    });

    it('provides quickfix for missing function called in the markup', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(11, 1), Position.create(11, 4)),
            {
                diagnostics: [
                    {
                        code: 2304,
                        message: "Cannot find name 'abc'.",
                        range: Range.create(Position.create(11, 1), Position.create(11, 4)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        );

        testFixMissingFunctionQuickFix(codeActions);
    });

    function testFixMissingFunctionQuickFix(codeActions: CodeAction[]) {
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
                                    newText:
                                        "\n\nfunction abc() {\nthrow new Error('Function not implemented.');\n}\n",
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 10
                                        },
                                        end: {
                                            character: 0,
                                            line: 10
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: CodeActionKind.QuickFix,
                title: "Add missing function declaration 'abc'"
            }
        ]);
    }

    it('provides quickfix for ts-checked-js', async () => {
        const { provider, document } = setup('codeaction-checkJs.svelte');
        const errorRange = Range.create(Position.create(2, 21), Position.create(2, 26));

        const codeActions = await provider.getCodeActions(document, errorRange, {
            diagnostics: [
                {
                    code: 2304,
                    message: "Cannot find name 'blubb'.",
                    range: errorRange
                }
            ]
        });

        for (const codeAction of codeActions) {
            (<TextDocumentEdit>codeAction.edit?.documentChanges?.[0])?.edits.forEach(
                (edit) => (edit.newText = harmonizeNewLines(edit.newText))
            );
        }

        const textDocument = {
            uri: getUri('codeaction-checkJs.svelte'),
            version: null
        };
        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '\nimport { blubb } from "../definitions";\n\n',
                                    range: Range.create(
                                        Position.create(0, 8),
                                        Position.create(0, 8)
                                    )
                                }
                            ],
                            textDocument
                        }
                    ]
                },
                kind: 'quickfix',
                title: 'Import \'blubb\' from module "../definitions"'
            },
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '// @ts-ignore\n    ',
                                    range: Range.create(
                                        Position.create(2, 4),
                                        Position.create(2, 4)
                                    )
                                }
                            ],
                            textDocument
                        }
                    ]
                },
                kind: 'quickfix',
                title: 'Ignore this error message'
            },
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '\n// @ts-nocheck',
                                    range: Range.create(
                                        Position.create(0, 8),
                                        Position.create(0, 8)
                                    )
                                }
                            ],
                            textDocument
                        }
                    ]
                },

                kind: 'quickfix',
                title: 'Disable checking for this file'
            }
        ]);
    });

    it('provides quickfix for component import', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(12, 1), Position.create(12, 1)),
            {
                diagnostics: [
                    {
                        code: 2304,
                        message: "Cannot find name 'Empty'.",
                        range: Range.create(Position.create(12, 1), Position.create(12, 6)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        );

        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: "import Empty from '../empty.svelte';\r\n",
                                    range: {
                                        end: Position.create(5, 0),
                                        start: Position.create(5, 0)
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'quickfix',
                title: 'Import default \'Empty\' from module "../empty.svelte"'
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
                                            character: 0,
                                            line: 5
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null
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
                                    newText: "import A from './A';\n  import { c } from './c';\n",
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
                                            line: 8,
                                            character: 0
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-with-module.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: CodeActionKind.SourceOrganizeImports,
                title: 'Organize Imports'
            }
        ]);
    });

    it('organizes imports with module script and store', async () => {
        const { provider, document } = setup('organize-imports-module-store.svelte');

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
                                    newText:
                                        "import { _,_d } from 'svelte-i18n';\n  import { _e } from 'svelte-i18n1';\n",
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 2
                                        },
                                        start: {
                                            character: 2,
                                            line: 1
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        end: {
                                            character: 2,
                                            line: 6
                                        },
                                        start: {
                                            character: 2,
                                            line: 5
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        end: {
                                            character: 2,
                                            line: 7
                                        },
                                        start: {
                                            character: 2,
                                            line: 6
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 2,
                                            line: 7
                                        },
                                        end: {
                                            character: 0,
                                            line: 8
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-module-store.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: CodeActionKind.SourceOrganizeImports,
                title: 'Organize Imports'
            }
        ]);
    });

    it('organizes imports which changes nothing (one import)', async () => {
        const { provider, document } = setup('organize-imports-unchanged1.svelte');

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
                                    newText: "import { c } from './c';\n",
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 2
                                        },
                                        start: {
                                            character: 2,
                                            line: 1
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-unchanged1.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'source.organizeImports',
                title: 'Organize Imports'
            }
        ]);
    });

    it('organizes imports which changes nothing (two imports)', async () => {
        const { provider, document } = setup('organize-imports-unchanged2.svelte');

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
                                    newText:
                                        "import { c } from './c';\n  import { d } from './d';\n",
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 2
                                        },
                                        start: {
                                            character: 2,
                                            line: 1
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 3
                                        },
                                        start: {
                                            character: 0,
                                            line: 2
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-unchanged2.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'source.organizeImports',
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
                        version: null
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
                                    line: 10
                                },
                                end: {
                                    character: 0,
                                    line: 10
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeactions.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('can cancel quick fix before promise resolved', async () => {
        const { provider, document } = setup('codeactions.svelte');
        const cancellationTokenSource = new CancellationTokenSource();

        const codeActionsPromise = provider.getCodeActions(
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
            },
            cancellationTokenSource.token
        );

        cancellationTokenSource.cancel();

        assert.deepStrictEqual(await codeActionsPromise, []);
    });

    it('can cancel refactor before promise resolved', async () => {
        const { provider, document } = setup('codeactions.svelte');
        const cancellationTokenSource = new CancellationTokenSource();

        const codeActionsPromise = provider.getCodeActions(
            document,
            Range.create(Position.create(8, 8), Position.create(8, 42)),
            { diagnostics: [], only: [CodeActionKind.Refactor] },
            cancellationTokenSource.token
        );

        cancellationTokenSource.cancel();

        assert.deepStrictEqual(await codeActionsPromise, []);
    });
});
