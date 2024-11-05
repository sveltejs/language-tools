import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    CompletionContext,
    SelectionRange,
    CompletionTriggerKind,
    FoldingRangeKind
} from 'vscode-languageserver';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { CSSPlugin } from '../../../src/plugins';
import { LSConfigManager } from '../../../src/ls-config';
import { createLanguageServices } from '../../../src/plugins/css/service';
import { pathToUrl } from '../../../src/utils';
import { FileType, LanguageServiceOptions } from 'vscode-css-languageservice';

describe('CSS Plugin', () => {
    function setup(content: string, lsOptions?: LanguageServiceOptions) {
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new CSSPlugin(
            docManager,
            pluginManager,
            [
                {
                    name: '',
                    uri: pathToUrl(process.cwd())
                }
            ],
            createLanguageServices(lsOptions)
        );
        docManager.openClientDocument(<any>'some doc');
        return { plugin, document };
    }

    describe('provides hover info', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {}</style>');

            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 8)), <Hover>{
                contents: [
                    { language: 'html', value: '<h1>' },
                    '[Selector Specificity](https://developer.mozilla.org/docs/Web/CSS/Specificity): (0, 0, 1)'
                ],
                range: Range.create(0, 7, 0, 9)
            });

            assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
        });

        it('not for SASS', () => {
            const { plugin, document } = setup('<style lang="sass">h1 {}</style>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 20)), null);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup('<style lang="stylus">h1 {}</style>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 22)), null);
        });

        it('for style attribute', () => {
            const { plugin, document } = setup('<div style="height: auto;"></div>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 13)), <Hover>{
                contents: {
                    kind: 'markdown',
                    value:
                        "Specifies the height of the content area, padding area or border area \\(depending on 'box\\-sizing'\\) of certain boxes\\.\n\n" +
                        '(Edge 12, Firefox 1, Safari 1, Chrome 1, IE 4, Opera 7)\n\n' +
                        'Syntax: auto | &lt;length&gt; | &lt;percentage&gt; | min\\-content | max\\-content | fit\\-content | fit\\-content\\(&lt;length\\-percentage&gt;\\)\n\n' +
                        '[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/height)'
                },
                range: Range.create(0, 12, 0, 24)
            });
        });

        it('not for style attribute with interpolation', () => {
            const { plugin, document } = setup('<div style="height: {}"></div>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 13)), null);
        });
    });

    describe('provides completions', () => {
        it('for normal css', async () => {
            const { plugin, document } = setup('<style></style>');

            const completions = await plugin.getCompletions(document, Position.create(0, 7), {
                triggerCharacter: '.'
            } as CompletionContext);
            assert.ok(
                Array.isArray(completions && completions.items),
                'Expected completion items to be an array'
            );
            assert.ok(completions!.items.length > 0, 'Expected completions to have length');

            assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
                label: '@charset',
                kind: CompletionItemKind.Keyword,
                documentation: {
                    kind: 'markdown',
                    value:
                        'Defines character set of the document\\.\n\n(Edge 12, Firefox 1, Safari 4, Chrome 2, IE 5, Opera 9)\n\n' +
                        '[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/@charset)'
                },
                textEdit: TextEdit.insert(Position.create(0, 7), '@charset'),
                tags: []
            });
        });

        it('for :global modifier', async () => {
            const { plugin, document } = setup('<style>:g</style>');

            const completions = await plugin.getCompletions(document, Position.create(0, 9), {
                triggerCharacter: ':'
            } as CompletionContext);
            const globalCompletion = completions?.items.find((item) => item.label === ':global()');
            assert.ok(globalCompletion);
        });

        it('not for stylus', async () => {
            const { plugin, document } = setup('<style lang="stylus"></style>');
            const completions = await plugin.getCompletions(document, Position.create(0, 21), {
                triggerCharacter: '.'
            } as CompletionContext);
            assert.deepStrictEqual(completions, null);
        });

        it('for style attribute', async () => {
            const { plugin, document } = setup('<div style="display: n"></div>');
            const completions = await plugin.getCompletions(document, Position.create(0, 22), {
                triggerKind: CompletionTriggerKind.Invoked
            } as CompletionContext);
            assert.deepStrictEqual(
                completions?.items.find((item) => item.label === 'none'),
                <CompletionItem>{
                    insertTextFormat: undefined,
                    kind: 12,
                    label: 'none',
                    documentation: {
                        kind: 'markdown',
                        value: 'The element and its descendants generates no boxes\\.'
                    },
                    sortText: ' ',
                    tags: [],
                    textEdit: {
                        newText: 'none',
                        range: {
                            start: {
                                line: 0,
                                character: 21
                            },
                            end: {
                                line: 0,
                                character: 22
                            }
                        }
                    }
                }
            );
        });

        it('not for style attribute with interpolation', async () => {
            const { plugin, document } = setup('<div style="height: {}"></div>');
            assert.deepStrictEqual(
                await plugin.getCompletions(document, Position.create(0, 21)),
                null
            );
        });

        it('for path completion', async () => {
            const { plugin, document } = setup('<style>@import "./"</style>', {
                fileSystemProvider: {
                    stat: () =>
                        Promise.resolve({
                            ctime: Date.now(),
                            mtime: Date.now(),
                            size: 0,
                            type: FileType.File
                        }),
                    readDirectory: () => Promise.resolve([['foo.css', FileType.File]])
                }
            });
            const completions = await plugin.getCompletions(document, Position.create(0, 16));
            assert.deepStrictEqual(
                completions?.items.find((item) => item.label === 'foo.css'),
                <CompletionItem>{
                    label: 'foo.css',
                    kind: 17,
                    textEdit: {
                        newText: 'foo.css',
                        range: {
                            end: {
                                character: 18,
                                line: 0
                            },
                            start: {
                                character: 16,
                                line: 0
                            }
                        }
                    }
                }
            );
        });
    });

    describe('provides diagnostics', () => {
        it('- everything ok', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, []);
        });

        it('- has error', () => {
            const { plugin, document } = setup('<style>h1 {iDunnoDisProperty:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, [
                {
                    code: 'unknownProperties',
                    message: "Unknown property: 'iDunnoDisProperty'",
                    range: {
                        end: {
                            character: 28,
                            line: 0
                        },
                        start: {
                            character: 11,
                            line: 0
                        }
                    },
                    severity: 2,
                    source: 'css'
                }
            ]);
        });

        it('- no diagnostics for sass', () => {
            const { plugin, document } = setup(
                `<style lang="sass">
                h1
                    iDunnoDisProperty:blue
                </style>`
            );
            const diagnostics = plugin.getDiagnostics(document);
            assert.deepStrictEqual(diagnostics, []);
        });

        it('- no diagnostics for stylus', () => {
            const { plugin, document } = setup(
                `<style lang="sass">
                h1
                    iDunnoDisProperty:blue
                </style>`
            );
            const diagnostics = plugin.getDiagnostics(document);
            assert.deepStrictEqual(diagnostics, []);
        });
    });

    describe('provides document colors', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const colors = plugin.getColorPresentations(
                document,
                {
                    start: { line: 0, character: 17 },
                    end: { line: 0, character: 21 }
                },
                { alpha: 1, blue: 255, green: 0, red: 0 }
            );

            assert.deepStrictEqual(colors, [
                {
                    label: 'rgb(0, 0, 65025)',
                    textEdit: {
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        },
                        newText: 'rgb(0, 0, 65025)'
                    }
                },
                {
                    label: '#00000fe01',
                    textEdit: {
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        },
                        newText: '#00000fe01'
                    }
                },
                {
                    label: 'hsl(240, -101%, 12750%)',
                    textEdit: {
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        },
                        newText: 'hsl(240, -101%, 12750%)'
                    }
                },
                {
                    label: 'hwb(240 0% -25400%)',
                    textEdit: {
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        },
                        newText: 'hwb(240 0% -25400%)'
                    }
                }
            ]);
        });

        it('not for SASS', () => {
            const { plugin, document } = setup(`<style lang="sass">
            h1
                color:blue
            </style>`);

            assert.deepStrictEqual(
                plugin.getColorPresentations(
                    document,
                    {
                        start: { line: 2, character: 22 },
                        end: { line: 2, character: 26 }
                    },
                    { alpha: 1, blue: 255, green: 0, red: 0 }
                ),
                []
            );
            assert.deepStrictEqual(plugin.getDocumentColors(document), []);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup(`<style lang="stylus">
            h1
                color:blue
            </style>`);

            assert.deepStrictEqual(
                plugin.getColorPresentations(
                    document,
                    {
                        start: { line: 2, character: 22 },
                        end: { line: 2, character: 26 }
                    },
                    { alpha: 1, blue: 255, green: 0, red: 0 }
                ),
                []
            );
            assert.deepStrictEqual(plugin.getDocumentColors(document), []);
        });
    });

    describe('provides document symbols', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const symbols = plugin.getDocumentSymbols(document);

            assert.deepStrictEqual(symbols, [
                {
                    containerName: 'style',
                    kind: 5,
                    location: {
                        range: {
                            end: {
                                character: 23,
                                line: 0
                            },
                            start: {
                                character: 7,
                                line: 0
                            }
                        },
                        uri: 'file:///hello.svelte'
                    },
                    name: 'h1'
                }
            ]);
        });

        it('not for SASS', () => {
            const { plugin, document } = setup('<style lang="sass">h1 {color:blue;}</style>');
            assert.deepStrictEqual(plugin.getDocumentSymbols(document), []);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup('<style lang="stylus">h1 {color:blue;}</style>');
            assert.deepStrictEqual(plugin.getDocumentSymbols(document), []);
        });
    });

    it('provides selection range', () => {
        const { plugin, document } = setup('<style>h1 {}</style>');

        const selectionRange = plugin.getSelectionRange(document, Position.create(0, 11));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
                parent: {
                    parent: undefined,
                    range: {
                        end: {
                            character: 12,
                            line: 0
                        },
                        start: {
                            character: 7,
                            line: 0
                        }
                    }
                },
                range: {
                    end: {
                        character: 12,
                        line: 0
                    },
                    start: {
                        character: 10,
                        line: 0
                    }
                }
            },
            range: {
                end: {
                    character: 11,
                    line: 0
                },
                start: {
                    character: 11,
                    line: 0
                }
            }
        });
    });

    it('return null for selection range when not in style', () => {
        const { plugin, document } = setup('<script></script>');

        const selectionRange = plugin.getSelectionRange(document, Position.create(0, 10));

        assert.equal(selectionRange, null);
    });

    describe('folding ranges', () => {
        it('provides folding ranges', () => {
            const { plugin, document } = setup('<style>\n.hi {\ndisplay:none;\n}\n</style>');

            const foldingRanges = plugin.getFoldingRanges(document);

            assert.deepStrictEqual(foldingRanges, [{ startLine: 1, endLine: 2, kind: undefined }]);
        });

        it('provides folding ranges for known indent style', () => {
            const { plugin, document } = setup(
                '<style lang="sass">\n/*#region*/\n.hi\n  display:none\n.hi2\n  display: none\n/*#endregion*/\n</style>'
            );

            const foldingRanges = plugin.getFoldingRanges(document);

            assert.deepStrictEqual(foldingRanges, [
                { startLine: 1, endLine: 6, kind: FoldingRangeKind.Region },
                { startLine: 2, endLine: 3 },
                { startLine: 4, endLine: 5 }
            ]);
        });
    });
});
