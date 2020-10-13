import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    CompletionContext
} from 'vscode-languageserver';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { CSSPlugin } from '../../../src/plugins';
import { LSConfigManager } from '../../../src/ls-config';

describe('CSS Plugin', () => {
    function setup(content: string) {
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new CSSPlugin(docManager, pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    describe('provides hover info', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {}</style>');

            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 8)), <Hover>{
                contents: [
                    { language: 'html', value: '<h1>' },
                    '[Selector Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity): (0, 0, 1)'
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
    });

    describe('provides completions', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style></style>');

            const completions = plugin.getCompletions(document, Position.create(0, 7), {
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
                        'Defines character set of the document.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/@charset)'
                },
                sortText: 'd_0000',
                textEdit: TextEdit.insert(Position.create(0, 7), '@charset'),
                tags: []
            });
        });

        it('for :global modifier', () => {
            const { plugin, document } = setup('<style>:g</style>');

            const completions = plugin.getCompletions(document, Position.create(0, 9), {
                triggerCharacter: ':'
            } as CompletionContext);
            const globalCompletion = completions?.items.find((item) => item.label === ':global()');
            assert.ok(globalCompletion);
        });

        it('not for stylus', () => {
            const { plugin, document } = setup('<style lang="stylus"></style>');
            const completions = plugin.getCompletions(document, Position.create(0, 21), {
                triggerCharacter: '.'
            } as CompletionContext);
            assert.deepStrictEqual(completions, null);
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
});
