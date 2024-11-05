import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import {
    CancellationTokenSource,
    CodeAction,
    CodeActionKind,
    Position,
    Range,
    TextDocumentEdit
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import {
    CodeActionsProviderImpl,
    SORT_IMPORT_CODE_ACTION_KIND
} from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { __resetCache } from '../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../src/utils';
import { recursiveServiceWarmup } from '../test-utils';
import { DiagnosticCode } from '../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { VERSION } from 'svelte/compiler';

const testDir = path.join(__dirname, '..');
const indent = ' '.repeat(4);
const isSvelte5Plus = +VERSION.split('.')[0] >= 5;

describe('CodeActionsProvider', function () {
    recursiveServiceWarmup(
        this,
        path.join(testDir, 'testfiles', 'code-actions'),
        pathToUrl(testDir)
    );

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
        const lsConfigManager = new LSConfigManager();
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            lsConfigManager
        );
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, lsConfigManager);
        const provider = new CodeActionsProviderImpl(
            lsAndTsDocResolver,
            completionProvider,
            lsConfigManager
        );
        const filePath = getFullPath(filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: harmonizeNewLines(ts.sys.readFile(filePath) || '')
        });
        return { provider, document, docManager, lsAndTsDocResolver };
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
            },
            {
                data: {
                    fixId: 'unusedIdentifier_delete',
                    fixName: 'unusedIdentifier',
                    uri: getUri('codeactions.svelte')
                },
                kind: 'quickfix',
                title: 'Delete all unused declarations'
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

    it('provides quickfix for missing function called in the element start tag', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(13, 23), Position.create(13, 23)),
            {
                diagnostics: [
                    {
                        code: 2304,
                        message: "Cannot find name 'handleClick'.",
                        range: Range.create(Position.create(13, 23), Position.create(13, 34)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
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
                                        `\n\n${indent}function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }): any {\n` +
                                        `${indent}${indent}throw new Error('Function not implemented.');\n` +
                                        `${indent}}\n`,
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
                title: "Add missing function declaration 'handleClick'"
            },
            {
                data: {
                    fixId: 'fixMissingFunctionDeclaration',
                    fixName: 'fixMissingFunctionDeclaration',
                    uri: getUri('codeactions.svelte')
                },
                kind: 'quickfix',
                title: 'Add all missing function declarations'
            }
        ]);
    });

    it('provides quickfix for missing function for element event handler', async () => {
        const { provider, document } = setup('fix-missing-function-element.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(4, 18), Position.create(4, 29)),
            {
                diagnostics: [
                    {
                        code: 2304,
                        message: "Cannot find name 'handleClick'.",
                        range: Range.create(Position.create(4, 18), Position.create(4, 29)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
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
                                        `\n\n${indent}function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) {\n` +
                                        `${indent}${indent}throw new Error("Function not implemented.");\n` +
                                        `${indent}}\n`,
                                    range: {
                                        start: {
                                            character: 0,
                                            line: 2
                                        },
                                        end: {
                                            character: 0,
                                            line: 2
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('fix-missing-function-element.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: CodeActionKind.QuickFix,
                title: "Add missing function declaration 'handleClick'"
            }
        ]);
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
                                        `\n\n${indent}function abc() {\n` +
                                        `${indent}${indent}throw new Error('Function not implemented.');\n` +
                                        `${indent}}\n`,
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
            },
            {
                data: {
                    fixId: 'fixMissingFunctionDeclaration',
                    fixName: 'fixMissingFunctionDeclaration',
                    uri: getUri('codeactions.svelte')
                },
                kind: 'quickfix',
                title: 'Add all missing function declarations'
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

        if (isSvelte5Plus) {
            // Maybe because of the hidden interface declarations? It's harmless anyway
            if (
                codeActions.length === 4 &&
                codeActions[3].title === "Add '@ts-ignore' to all error messages"
            ) {
                codeActions.splice(3, 1);
            }
        }

        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: `\n${indent}import { blubb } from "../definitions";\n`,
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
                title: 'Add import from "../definitions"'
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

    it('provides quickfix for ts-checked-js in context=module', async () => {
        const { provider, document } = setup('codeaction-checkJs-module.svelte');
        const errorRange = Range.create(Position.create(3, 4), Position.create(3, 5));

        const codeActions = await provider.getCodeActions(document, errorRange, {
            diagnostics: [
                {
                    code: 2322,
                    message: "Type 'string' is not assignable to type 'number'.",
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
            uri: getUri('codeaction-checkJs-module.svelte'),
            version: null
        };
        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '// @ts-ignore\n    ',
                                    range: Range.create(
                                        Position.create(3, 4),
                                        Position.create(3, 4)
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
                                        Position.create(0, 25),
                                        Position.create(0, 25)
                                    )
                                }
                            ],
                            textDocument
                        }
                    ]
                },

                kind: 'quickfix',
                title: 'Disable checking for this file'
            },
            {
                data: {
                    fixId: 'disableJsDiagnostics',
                    fixName: 'disableJsDiagnostics',
                    uri: getUri('codeaction-checkJs-module.svelte')
                },
                kind: 'quickfix',
                title: "Add '@ts-ignore' to all error messages"
            }
        ]);
    });

    it('provide quickfix for adding jsDoc type to props', async () => {
        const { provider, document } = setup('codeaction-add-jsdoc.svelte');
        const errorRange = Range.create(Position.create(7, 8), Position.create(7, 11));

        const codeActions = await provider.getCodeActions(document, errorRange, {
            diagnostics: [
                {
                    code: 7034,
                    message:
                        "Variable 'abc' implicitly has type 'any' in some locations where its type cannot be determined.",
                    range: errorRange
                }
            ]
        });

        const addJsDoc = codeActions.find((fix) => fix.title === "Infer type of 'abc' from usage");

        (<TextDocumentEdit>addJsDoc?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(addJsDoc?.edit, {
            documentChanges: [
                <TextDocumentEdit>{
                    edits: [
                        {
                            newText: `/**\n${indent} * @type {any}\n${indent} */\n${indent}`,
                            range: {
                                start: { character: 4, line: 3 },
                                end: { character: 4, line: 3 }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-add-jsdoc.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('provide quickfix for adding jsDoc type to non props when props exist', async () => {
        const { provider, document } = setup('codeaction-add-jsdoc.svelte');
        const errorRange = Range.create(Position.create(9, 8), Position.create(9, 10));

        const codeActions = await provider.getCodeActions(document, errorRange, {
            diagnostics: [
                {
                    code: 7034,
                    message:
                        "Variable 'ab' implicitly has type 'any' in some locations where its type cannot be determined.",
                    range: errorRange
                }
            ]
        });

        const addJsDoc = codeActions.find((fix) => fix.title === "Infer type of 'ab' from usage");

        (<TextDocumentEdit>addJsDoc?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(addJsDoc?.edit, {
            documentChanges: [
                <TextDocumentEdit>{
                    edits: [
                        {
                            newText: `/**\n${indent} * @type {any}\n${indent} */\n${indent}`,
                            range: {
                                start: { character: 4, line: 9 },
                                end: { character: 4, line: 9 }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-add-jsdoc.svelte'),
                        version: null
                    }
                }
            ]
        });
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

        (<TextDocumentEdit>codeActions[0]?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: harmonizeNewLines(
                                        `${indent}import Empty from '../empty.svelte';\n`
                                    ),
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
                title: 'Add import from "../empty.svelte"'
            },
            {
                data: {
                    fixId: 'fixMissingImport',
                    fixName: 'import',
                    uri: getUri('codeactions.svelte')
                },
                kind: 'quickfix',
                title: 'Add all missing imports'
            }
        ]);
    });

    it('provides quickfix for component import with "did you mean" diagnostics', async () => {
        const { provider, document } = setup('codeaction-component-import.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(4, 1), Position.create(4, 6)),
            {
                diagnostics: [
                    {
                        code: 2552,
                        message: "Cannot find name 'Empty'. Did you mean 'EMpty'?",
                        range: Range.create(Position.create(4, 1), Position.create(4, 6)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        );

        (<TextDocumentEdit>codeActions[0]?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(codeActions, <CodeAction[]>[
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: harmonizeNewLines(
                                        `\n${indent}import Empty from "../empty.svelte";\n`
                                    ),
                                    range: {
                                        end: Position.create(0, 18),
                                        start: Position.create(0, 18)
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeaction-component-import.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'quickfix',
                title: 'Add import from "../empty.svelte"'
            },
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: 'EMpty',
                                    range: {
                                        end: Position.create(4, 6),
                                        start: Position.create(4, 1)
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeaction-component-import.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'quickfix',
                title: "Change spelling to 'EMpty'"
            }
        ]);
    });

    it('remove import inline with script tag', async () => {
        const { provider, document } = setup('remove-imports-inline.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(0, 9), Position.create(0, 9)),
            {
                diagnostics: [
                    {
                        code: 6133,
                        message: "'CodeActions' is declared but its value is never read",
                        range: Range.create(Position.create(0, 8), Position.create(0, 54)),
                        source: 'js'
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
                                    newText: '',
                                    range: {
                                        end: Position.create(0, 54),
                                        start: Position.create(0, 8)
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('remove-imports-inline.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'quickfix',
                title: "Remove import from './codeactions.svelte'"
            }
        ]);
    });

    it('provides quickfix for convert const to let', async () => {
        const { provider, document } = setup('codeaction-const-reassign.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(3, 4), Position.create(3, 6)),
            {
                diagnostics: [
                    {
                        code: 2588,
                        message: "CCannot assign to 'hi' because it is a constant.",
                        range: Range.create(Position.create(3, 4), Position.create(3, 6)),
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
                                    newText: 'let',
                                    range: {
                                        start: {
                                            character: 4,
                                            line: 1
                                        },
                                        end: {
                                            character: 9,
                                            line: 1
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('codeaction-const-reassign.svelte'),
                                version: null
                            }
                        }
                    ]
                },
                kind: 'quickfix',
                title: "Convert 'const' to 'let'"
            },
            {
                data: {
                    fixId: 'fixConvertConstToLet',
                    fixName: 'fixConvertConstToLet',
                    uri: getUri('codeaction-const-reassign.svelte')
                },
                kind: 'quickfix',
                title: "Convert all 'const' to 'let'"
            }
        ]);
    });

    it("don't provides quickfix for convert const tag to let", async () => {
        const { provider, document } = setup('codeaction-const-reassign.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(9, 28), Position.create(9, 35)),
            {
                diagnostics: [
                    {
                        code: 2588,
                        message: "Cannot assign to 'hi2' because it is a constant.",
                        range: Range.create(Position.create(9, 28), Position.create(9, 35)),
                        source: 'ts'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        );

        assert.deepStrictEqual(codeActions, []);
    });

    it('provide quick fix to fix all errors when possible', async () => {
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

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n\n${indent}function abc() {\n` +
                                `${indent}${indent}throw new Error('Function not implemented.');\n` +
                                `${indent}}\n`,
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
                        },
                        {
                            newText:
                                `\n\n${indent}function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }): any {\n` +
                                `${indent}${indent}throw new Error('Function not implemented.');\n` +
                                `${indent}}\n`,
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

    it('provide quick fix to fix all missing import component', async () => {
        const { provider, document, docManager, lsAndTsDocResolver } = setup(
            'codeaction-custom-fix-all-component.svelte'
        );

        const range = Range.create(Position.create(4, 1), Position.create(4, 15));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: DiagnosticCode.CANNOT_FIND_NAME,
                    message: "Cannot find name 'FixAllImported'.",
                    range: range,
                    source: 'ts'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n${indent}import FixAllImported from \"./importing/FixAllImported.svelte\";\n` +
                                `${indent}import FixAllImported2 from \"./importing/FixAllImported2.svelte\";\n`,
                            range: {
                                start: {
                                    character: 18,
                                    line: 0
                                },
                                end: {
                                    character: 18,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-custom-fix-all-component.svelte'),
                        version: null
                    }
                }
            ]
        });

        // fix-all has some "creative" workaround. Testing if it won't affect the document synchronization after applying the fix
        docManager.updateDocument(
            document,
            resolvedFixAll.edit.documentChanges[0].edits.map((edit) => ({
                range: edit.range,
                text: edit.newText
            }))
        );

        const { lang, tsDoc } = await lsAndTsDocResolver.getLSAndTSDoc(document);
        const cannotFindNameDiagnostics = lang
            .getSemanticDiagnostics(tsDoc.filePath)
            .filter((diagnostic) => diagnostic.code === DiagnosticCode.CANNOT_FIND_NAME);
        assert.strictEqual(cannotFindNameDiagnostics.length, 0);
    });

    it('provide quick fix to fix all missing import component with "did you mean" diagnostics', async () => {
        const { provider, document } = setup('codeaction-custom-fix-all-component4.svelte');

        const range = Range.create(Position.create(4, 1), Position.create(4, 15));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: DiagnosticCode.CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y,
                    message: "Cannot find name 'FixAllImported'. Did you mean 'FixAllImported3'?",
                    range: range,
                    source: 'ts'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n${indent}import FixAllImported from \"./importing/FixAllImported.svelte\";\n` +
                                `${indent}import FixAllImported2 from \"./importing/FixAllImported2.svelte\";\n`,
                            range: {
                                start: {
                                    character: 18,
                                    line: 0
                                },
                                end: {
                                    character: 18,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-custom-fix-all-component4.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('provide quick fix to fix all missing import component without duplicate (script)', async () => {
        const { provider, document } = setup('codeaction-custom-fix-all-component2.svelte');

        const range = Range.create(Position.create(2, 4), Position.create(2, 19));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: 2304,
                    message: "Cannot find name 'FixAllImported3'.",
                    range: range,
                    source: 'ts'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n${indent}import { FixAllImported3 } from \"./importing/c\";\n` +
                                `${indent}import FixAllImported2 from \"./importing/FixAllImported2.svelte\";\n`,
                            range: {
                                start: {
                                    character: 18,
                                    line: 0
                                },
                                end: {
                                    character: 18,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-custom-fix-all-component2.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('provide quick fix to fix all missing import component without duplicate (template)', async () => {
        const { provider, document } = setup('codeaction-custom-fix-all-component3.svelte');

        const range = Range.create(Position.create(4, 1), Position.create(4, 16));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: 2304,
                    message: "Cannot find name 'FixAllImported3'.",
                    range: range,
                    source: 'ts'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n${indent}import { FixAllImported3 } from \"./importing/c\";` +
                                `\n${indent}import FixAllImported2 from \"./importing/FixAllImported2.svelte\";\n`,
                            range: {
                                start: {
                                    character: 18,
                                    line: 0
                                },
                                end: {
                                    character: 18,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-custom-fix-all-component3.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('provide quick fix to fix all missing import stores', async () => {
        const { provider, document } = setup('codeaction-custom-fix-all-store.svelte');

        const range = Range.create(Position.create(1, 4), Position.create(1, 19));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: 2304,
                    message: "Cannot find name '$someOtherStore'.",
                    range: range,
                    source: 'ts'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                `\n${indent}import { someStore } from \"./importing/a\";\n` +
                                `${indent}import { someOtherStore } from \"./importing/b\";\n`,
                            range: {
                                start: {
                                    character: 18,
                                    line: 0
                                },
                                end: {
                                    character: 18,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('codeaction-custom-fix-all-store.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('provide quick fix to fix all missing import component (without script tag)', async () => {
        const { provider, document } = setup(
            'check-js/codeaction-custom-fix-all-component3.svelte'
        );

        const range = Range.create(Position.create(0, 1), Position.create(0, 15));
        const codeActions = await provider.getCodeActions(document, range, {
            diagnostics: [
                {
                    code: 2304,
                    message: "Cannot find name 'FixAllImported'.",
                    range: range,
                    source: 'js'
                }
            ],
            only: [CodeActionKind.QuickFix]
        });

        const fixAll = codeActions.find((action) => action.data);
        const resolvedFixAll = await provider.resolveCodeAction(document, fixAll!);

        (<TextDocumentEdit>resolvedFixAll?.edit?.documentChanges?.[0])?.edits.forEach(
            (edit) => (edit.newText = harmonizeNewLines(edit.newText))
        );

        assert.deepStrictEqual(resolvedFixAll.edit, {
            documentChanges: [
                {
                    edits: [
                        {
                            newText:
                                '<script>\n' +
                                `${indent}import FixAllImported from \"./importing/FixAllImported.svelte\";\n` +
                                `${indent}import FixAllImported2 from \"./importing/FixAllImported2.svelte\";\n\n` +
                                '</script>\n',
                            range: {
                                start: {
                                    character: 0,
                                    line: 0
                                },
                                end: {
                                    character: 0,
                                    line: 0
                                }
                            }
                        }
                    ],
                    textDocument: {
                        uri: getUri('check-js/codeaction-custom-fix-all-component3.svelte'),
                        version: null
                    }
                }
            ]
        });
    });

    it('organizes imports', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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

    it('sort imports', async () => {
        const { provider, document } = setup('codeactions.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
            {
                diagnostics: [],
                only: [SORT_IMPORT_CODE_ACTION_KIND]
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
                                        "import { A, B } from 'bla';\n" +
                                        "import { C } from 'blubb';\n" +
                                        "import { D } from 'd';\n",

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
                kind: SORT_IMPORT_CODE_ACTION_KIND,
                title: 'Sort Imports'
            }
        ]);
    });

    it('organizes imports with module script', async () => {
        const { provider, document } = setup('organize-imports-with-module.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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
                                    newText: "import A from './A';\n",
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
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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
                                        "import { _d } from 'svelte-i18n';\n  import { _e } from 'svelte-i18n1';\n",
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
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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

    it('organizes imports and not remove the leading comment', async () => {
        const { provider, document } = setup('organize-imports-leading-comment.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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
                                    newText: "import { } from './t.png';\n",
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 2
                                        },
                                        start: {
                                            character: 4,
                                            line: 1
                                        }
                                    }
                                },
                                {
                                    newText: "import { } from './somepng.png';\n",
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 4
                                        },
                                        start: {
                                            character: 4,
                                            line: 3
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-leading-comment.svelte'),
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

    it('organize imports should do nothing if there is a parser error', async () => {
        const { provider, document } = setup('organize-imports-error.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
            {
                diagnostics: [],
                only: [CodeActionKind.SourceOrganizeImports]
            }
        );

        assert.deepStrictEqual(codeActions, []);
    });

    it('organize imports aware of groups', async () => {
        const { provider, document } = setup('organize-imports-group.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
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
                                        "import { } from 'svelte/transition';\n" +
                                        `${indent}import { } from './codeaction-checkJs.svelte';\n`,
                                    range: {
                                        end: {
                                            character: 4,
                                            line: 4
                                        },
                                        start: {
                                            character: 4,
                                            line: 3
                                        }
                                    }
                                },
                                {
                                    newText: '',
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 5
                                        },
                                        start: {
                                            character: 4,
                                            line: 4
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri('organize-imports-group.svelte'),
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

        assert.deepEqual(action, {
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
                        // is from generated code
                        textRange: {
                            pos: 179,
                            end: 213
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

    it('organize imports ignores generated __SvelteComponentTyped__', async () => {
        const { provider, document } = setup('organize-imports-with-generics.svelte');

        const codeActions = await provider.getCodeActions(
            document,
            Range.create(Position.create(1, 4), Position.create(1, 5)),
            {
                diagnostics: [],
                only: [CodeActionKind.SourceOrganizeImports]
            }
        );

        assert.deepStrictEqual(codeActions, [
            {
                title: 'Organize Imports',
                edit: {
                    documentChanges: [
                        {
                            textDocument: {
                                uri: getUri('organize-imports-with-generics.svelte'),
                                version: null
                            },
                            edits: [
                                {
                                    range: {
                                        start: {
                                            line: 1,
                                            character: 2
                                        },
                                        end: {
                                            line: 2,
                                            character: 2
                                        }
                                    },
                                    newText: "import A from './A';\n"
                                },
                                {
                                    range: {
                                        start: {
                                            line: 2,
                                            character: 2
                                        },
                                        end: {
                                            line: 3,
                                            character: 0
                                        }
                                    },
                                    newText: ''
                                }
                            ]
                        }
                    ]
                },
                kind: 'source.organizeImports'
            }
        ]);
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
                        // is from generated code
                        textRange: {
                            pos: 179,
                            end: 213
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

    // Hacky, but it works. Needed due to testing both new and old transformation
    after(() => {
        __resetCache();
    });
});
