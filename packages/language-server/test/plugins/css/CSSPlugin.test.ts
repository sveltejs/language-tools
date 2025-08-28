import { describe, it, expect } from 'vitest';
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
    FoldingRangeKind,
    DocumentHighlight,
    DocumentHighlightKind
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

            expect(plugin.doHover(document, Position.create(0, 8))).toEqual<Hover>({
                contents: [
                    { language: 'html', value: '<h1>' },
                    '[Selector Specificity](https://developer.mozilla.org/docs/Web/CSS/Specificity): (0, 0, 1)'
                ],
                range: Range.create(0, 7, 0, 9)
            });

            expect(plugin.doHover(document, Position.create(0, 10))).toBeNull();
        });

        it('not for SASS', () => {
            const { plugin, document } = setup('<style lang="sass">h1 {}</style>');
            expect(plugin.doHover(document, Position.create(0, 20))).toBeNull();
        });

        it('not for stylus', () => {
            const { plugin, document } = setup('<style lang="stylus">h1 {}</style>');
            expect(plugin.doHover(document, Position.create(0, 22))).toBeNull();
        });

        it('for style attribute', () => {
            const { plugin, document } = setup('<div style="height: auto;"></div>');
            expect(plugin.doHover(document, Position.create(0, 13))).toEqual<Hover>({
                contents: {
                    kind: 'markdown',
                    value:
                        "Specifies the height of the content area, padding area or border area \\(depending on 'box\\-sizing'\\) of certain boxes\\.\n\n" +
                        '![Baseline icon](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgIGZpbGw6ICNDNEVFRDA7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgICAgZmlsbDogIzEyNTIyNTsgLyogRGFyayBtb2RlICovCiAgICAgIH0KICAgIH0KICA8L3N0eWxlPgogIDxwYXRoIGQ9Ik00MjAgMzBMMzkwIDYwTDQ4MCAxNTBMMzkwIDI0MEwzMzAgMTgwTDMwMCAyMTBMMzkwIDMwMEw1NDAgMTUwTDQyMCAzMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0xNTAgMEwzMCAxMjBMNjAgMTUwTDE1MCA2MEwyMTAgMTIwTDI0MCA5MEwxNTAgMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0zOTAgMEw0MjAgMzBMMTUwIDMwMEwwIDE1MEwzMCAxMjBMMTUwIDI0MEwzOTAgMFoiIGZpbGw9IiMxRUE0NDYiLz4KPC9zdmc+) _Widely available across major browsers (Baseline since 2015)_\n\n' +
                        'Syntax: auto | &lt;length\\-percentage \\[0,∞\\]&gt; | min\\-content | max\\-content | fit\\-content | fit\\-content\\(&lt;length\\-percentage \\[0,∞\\]&gt;\\) | &lt;calc\\-size\\(\\)&gt; | &lt;anchor\\-size\\(\\)&gt;\n\n' +
                        '[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/height)'
                },
                range: Range.create(0, 12, 0, 24)
            });
        });

        it('not for style attribute with interpolation', () => {
            const { plugin, document } = setup('<div style="height: {}"></div>');
            expect(plugin.doHover(document, Position.create(0, 13))).toBeNull();
        });
    });

    describe('provides completions', () => {
        it('for normal css', async () => {
            const { plugin, document } = setup('<style></style>');

            const completions = await plugin.getCompletions(document, Position.create(0, 7), {
                triggerCharacter: '.'
            } as CompletionContext);
            expect(Array.isArray(completions && completions.items)).toBe(true);
            expect(completions!.items.length > 0).toBeTruthy();

            expect(completions!.items[0]).toEqual(<CompletionItem>{
                label: '@charset',
                kind: CompletionItemKind.Keyword,
                documentation: {
                    kind: 'markdown',
                    value:
                        'Defines character set of the document\\.\n\n' +
                        '![Baseline icon](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgIGZpbGw6ICNDNEVFRDA7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgICAgZmlsbDogIzEyNTIyNTsgLyogRGFyayBtb2RlICovCiAgICAgIH0KICAgIH0KICA8L3N0eWxlPgogIDxwYXRoIGQ9Ik00MjAgMzBMMzkwIDYwTDQ4MCAxNTBMMzkwIDI0MEwzMzAgMTgwTDMwMCAyMTBMMzkwIDMwMEw1NDAgMTUwTDQyMCAzMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0xNTAgMEwzMCAxMjBMNjAgMTUwTDE1MCA2MEwyMTAgMTIwTDI0MCA5MEwxNTAgMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0zOTAgMEw0MjAgMzBMMTUwIDMwMEwwIDE1MEwzMCAxMjBMMTUwIDI0MEwzOTAgMFoiIGZpbGw9IiMxRUE0NDYiLz4KPC9zdmc+) _Widely available across major browsers (Baseline since 2015)_\n\n' +
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
            expect(globalCompletion);
        });

        it('not for stylus', async () => {
            const { plugin, document } = setup('<style lang="stylus"></style>');
            const completions = await plugin.getCompletions(document, Position.create(0, 21), {
                triggerCharacter: '.'
            } as CompletionContext);
            expect(completions).toEqual(null);
        });

        it('for style attribute', async () => {
            const { plugin, document } = setup('<div style="display: n"></div>');
            const completions = await plugin.getCompletions(document, Position.create(0, 22), {
                triggerKind: CompletionTriggerKind.Invoked
            } as CompletionContext);
            expect(completions?.items.find((item) => item.label === 'none')).toEqual(<
                CompletionItem
            >{
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
            });
        });

        it('not for style attribute with interpolation', async () => {
            const { plugin, document } = setup('<div style="height: {}"></div>');
            expect(await plugin.getCompletions(document, Position.create(0, 21))).toEqual(null);
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
            expect(completions?.items.find((item) => item.label === 'foo.css')).toEqual(<
                CompletionItem
            >{
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
            });
        });
    });

    describe('provides diagnostics', () => {
        it('- everything ok', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            expect(diagnostics).toEqual([]);
        });

        it('- has error', () => {
            const { plugin, document } = setup('<style>h1 {iDunnoDisProperty:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            expect(diagnostics).toEqual([
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
            expect(diagnostics).toEqual([]);
        });

        it('- no diagnostics for stylus', () => {
            const { plugin, document } = setup(
                `<style lang="sass">
                h1
                    iDunnoDisProperty:blue
                </style>`
            );
            const diagnostics = plugin.getDiagnostics(document);
            expect(diagnostics).toEqual([]);
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

            expect(colors).toEqual([
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
                },
                {
                    label: 'lab(3880.51% 6388.69 -8701.22)',
                    textEdit: {
                        newText: 'lab(3880.51% 6388.69 -8701.22)',
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        }
                    }
                },
                {
                    label: 'lch(3880.51% 10794.75 306.29)',
                    textEdit: {
                        newText: 'lch(3880.51% 10794.75 306.29)',
                        range: {
                            end: {
                                character: 21,
                                line: 0
                            },
                            start: {
                                character: 17,
                                line: 0
                            }
                        }
                    }
                }
            ]);
        });

        it('not for SASS', () => {
            const { plugin, document } = setup(`<style lang="sass">
            h1
                color:blue
            </style>`);

            expect(
                plugin.getColorPresentations(
                    document,
                    {
                        start: { line: 2, character: 22 },
                        end: { line: 2, character: 26 }
                    },
                    { alpha: 1, blue: 255, green: 0, red: 0 }
                )
            ).toEqual([]);
            expect(plugin.getDocumentColors(document)).toEqual([]);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup(`<style lang="stylus">
            h1
                color:blue
            </style>`);

            expect(
                plugin.getColorPresentations(
                    document,
                    {
                        start: { line: 2, character: 22 },
                        end: { line: 2, character: 26 }
                    },
                    { alpha: 1, blue: 255, green: 0, red: 0 }
                )
            ).toEqual([]);
            expect(plugin.getDocumentColors(document)).toEqual([]);
        });
    });

    describe('provides document symbols', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const symbols = plugin.getDocumentSymbols(document);

            expect(symbols).toEqual([
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
            expect(plugin.getDocumentSymbols(document)).toEqual([]);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup('<style lang="stylus">h1 {color:blue;}</style>');
            expect(plugin.getDocumentSymbols(document)).toEqual([]);
        });
    });

    it('provides selection range', () => {
        const { plugin, document } = setup('<style>h1 {}</style>');

        const selectionRange = plugin.getSelectionRange(document, Position.create(0, 11));

        expect(selectionRange).toEqual(<SelectionRange>{
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

        expect(selectionRange).toEqual(null);
    });

    describe('folding ranges', () => {
        it('provides folding ranges', () => {
            const { plugin, document } = setup('<style>\n.hi {\ndisplay:none;\n}\n</style>');

            const foldingRanges = plugin.getFoldingRanges(document);

            expect(foldingRanges).toEqual([{ startLine: 1, endLine: 2, kind: undefined }]);
        });

        it('provides folding ranges for known indent style', () => {
            const { plugin, document } = setup(
                '<style lang="sass">\n/*#region*/\n.hi\n  display:none\n.hi2\n  display: none\n/*#endregion*/\n</style>'
            );

            const foldingRanges = plugin.getFoldingRanges(document);

            expect(foldingRanges).toEqual([
                { startLine: 1, endLine: 6, kind: FoldingRangeKind.Region },
                { startLine: 2, endLine: 3 },
                { startLine: 4, endLine: 5 }
            ]);
        });
    });

    describe('document highlight', () => {
        it('provide document highlight', () => {
            const { plugin, document } = setup('<style>.hi {} button.hi {}</style>');

            const highlight = plugin.findDocumentHighlight(document, Position.create(0, 9));

            expect(highlight).toEqual(<DocumentHighlight[]>[
                {
                    range: {
                        start: {
                            line: 0,
                            character: 7
                        },
                        end: {
                            line: 0,
                            character: 10
                        }
                    },
                    kind: DocumentHighlightKind.Write
                },
                {
                    range: {
                        start: {
                            line: 0,
                            character: 20
                        },
                        end: {
                            line: 0,
                            character: 23
                        }
                    },
                    kind: DocumentHighlightKind.Read
                }
            ]);
        });

        it('provide document highlight for style attribute', () => {
            const { plugin, document } = setup('<div style="position: relative"></div>');

            const highlight = plugin.findDocumentHighlight(document, Position.create(0, 13));

            expect(highlight).toEqual(<DocumentHighlight[]>[
                {
                    range: {
                        start: {
                            line: 0,
                            character: 12
                        },
                        end: {
                            line: 0,
                            character: 20
                        }
                    },
                    kind: DocumentHighlightKind.Read
                }
            ]);
        });

        it('provide word highlight for unsupported languages', () => {
            const { plugin, document } = setup('<style lang="postcss">.hi {}</style>');

            const highlight = plugin.findDocumentHighlight(document, Position.create(0, 25));

            expect(highlight).toEqual(<DocumentHighlight[]>[
                {
                    range: {
                        start: {
                            line: 0,
                            character: 22
                        },
                        end: {
                            line: 0,
                            character: 25
                        }
                    },
                    kind: DocumentHighlightKind.Text
                }
            ]);
        });
    });
});
