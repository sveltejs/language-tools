import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
} from '../../src/api';
import { TextDocument } from '../../src/lib/documents/TextDocument';
import { CSSPlugin } from '../../src/plugins/CSSPlugin';
import { DocumentManager } from '../../src/lib/documents/DocumentManager';
import { LSConfigManager } from '../../src/ls-config';

describe('CSS Plugin', () => {
    function setup(content: string) {
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        plugin.onRegister(docManager, pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides hover info', async () => {
        const { plugin, document } = setup('h1 {}');

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 1)), <Hover>{
            contents: [
                { language: 'html', value: '<h1>' },
                '[Selector Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity): (0, 0, 1)',
            ],
            range: Range.create(0, 0, 0, 2),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 3)), null);
    });

    it('provides completions', async () => {
        const { plugin, document } = setup('');

        const completions = plugin.getCompletions(document, Position.create(0, 0), ' ');
        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completion items to be an array',
        );
        assert.ok(completions!.items.length > 0, 'Expected completions to have length');

        assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
            label: '@charset',
            kind: CompletionItemKind.Keyword,
            documentation: {
                kind: 'markdown',
                value:
                    'Defines character set of the document.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/@charset)',
            },
            textEdit: TextEdit.insert(Position.create(0, 0), '@charset'),
            sortText: 'd_0000',
            tags: [],
        });
    });

    describe('provides diagnostics', () => {
        it('- everything ok', () => {
            const { plugin, document } = setup('h1 {color:blue;}');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, []);
        });

        it('- has error', () => {
            const { plugin, document } = setup('h1 {iDunnoDisProperty:blue;}');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, [
                {
                    code: 'unknownProperties',
                    message: "Unknown property: 'iDunnoDisProperty'",
                    range: {
                        end: {
                            character: 21,
                            line: 0,
                        },
                        start: {
                            character: 4,
                            line: 0,
                        },
                    },
                    severity: 2,
                    source: 'css',
                },
            ]);
        });
    });

    describe('provides document colors', () => {
        const { plugin, document } = setup('h1 {color:blue;}');

        const colors = plugin.getColorPresentations(
            document,
            {
                start: { line: 0, character: 10 },
                end: { line: 0, character: 14 },
            },
            { alpha: 1, blue: 255, green: 0, red: 0 },
        );

        assert.deepStrictEqual(colors, [
            {
                label: 'rgb(0, 0, 65025)',
                textEdit: {
                    range: {
                        end: {
                            character: 14,
                            line: 0,
                        },
                        start: {
                            character: 10,
                            line: 0,
                        },
                    },
                    newText: 'rgb(0, 0, 65025)',
                },
            },
            {
                label: '#00000fe01',
                textEdit: {
                    range: {
                        end: {
                            character: 14,
                            line: 0,
                        },
                        start: {
                            character: 10,
                            line: 0,
                        },
                    },
                    newText: '#00000fe01',
                },
            },
            {
                label: 'hsl(240, -101%, 12750%)',
                textEdit: {
                    range: {
                        end: {
                            character: 14,
                            line: 0,
                        },
                        start: {
                            character: 10,
                            line: 0,
                        },
                    },
                    newText: 'hsl(240, -101%, 12750%)',
                },
            },
        ]);
    });

    it('provides document symbols', () => {
        const { plugin, document } = setup('h1 {color:blue;}');

        const symbols = plugin.getDocumentSymbols(document);

        assert.deepStrictEqual(symbols, [
            {
                containerName: 'style',
                kind: 5,
                location: {
                    range: {
                        end: {
                            character: 16,
                            line: 0,
                        },
                        start: {
                            character: 0,
                            line: 0,
                        },
                    },
                    uri: 'file:///hello.svelte',
                },
                name: 'h1',
            },
        ]);
    });
});
