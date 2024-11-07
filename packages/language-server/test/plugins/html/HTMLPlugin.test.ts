import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    TextEdit,
    CompletionItemKind,
    InsertTextFormat,
    CompletionTriggerKind,
    FoldingRange
} from 'vscode-languageserver';
import { HTMLPlugin } from '../../../src/plugins';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';

describe('HTML Plugin', () => {
    function setup(content: string) {
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const configManager = new LSConfigManager();
        const plugin = new HTMLPlugin(docManager, configManager);
        docManager.openClientDocument(<any>'some doc');
        return { plugin, document, configManager };
    }

    it('provides hover info', async () => {
        const { plugin, document } = setup('<h1>Hello, world!</h1>');

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 2)), <Hover>{
            contents: {
                kind: 'markdown',
                value: 'The h1 element represents a section heading.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/Heading_Elements)'
            },

            range: Range.create(0, 1, 0, 3)
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
    });

    it('does not provide hover info for component having the same name as a html element but being uppercase', async () => {
        const { plugin, document } = setup('<Div></Div>');

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 2)), null);
    });

    it('provides completions', async () => {
        const { plugin, document } = setup('<');

        const completions = await plugin.getCompletions(document, Position.create(0, 1));
        assert.ok(Array.isArray(completions && completions.items));
        assert.ok(completions!.items.length > 0);

        assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
            label: '!DOCTYPE',
            kind: CompletionItemKind.Property,
            documentation: 'A preamble for an HTML document.',
            textEdit: TextEdit.insert(Position.create(0, 1), '!DOCTYPE html>'),
            insertTextFormat: InsertTextFormat.PlainText
        });
    });

    it('provide event handler completions', async () => {
        const { plugin, document } = setup('<div on');

        const completions = await plugin.getCompletions(document, Position.create(0, 7));
        const onClick = completions?.items.find((item) => item.label === 'on:click');

        assert.deepStrictEqual(onClick, <CompletionItem>{
            label: 'on:click',
            kind: CompletionItemKind.Value,
            documentation: {
                kind: 'markdown',
                value: 'A pointing device button has been pressed and released on an element.'
            },
            textEdit: TextEdit.replace(
                Range.create(Position.create(0, 5), Position.create(0, 7)),
                'on:click$2={$1}'
            ),
            insertTextFormat: InsertTextFormat.Snippet,
            command: undefined
        });
    });

    it('provide event handler completions in svelte strict mode', async () => {
        const { plugin, document, configManager } = setup('<div on');
        configManager.update({ svelte: { format: { config: { svelteStrictMode: true } } } });

        const completions = await plugin.getCompletions(document, Position.create(0, 7));
        const onClick = completions?.items.find((item) => item.label === 'on:click');

        assert.deepStrictEqual(
            onClick?.textEdit,
            TextEdit.replace(
                Range.create(Position.create(0, 5), Position.create(0, 7)),
                'on:click$2="{$1}"'
            )
        );
    });

    it('does not provide completions inside of moustache tag', async () => {
        const { plugin, document } = setup('<div on:click={() =>');

        const completions = await plugin.getCompletions(document, Position.create(0, 20));
        assert.strictEqual(completions, null);

        const tagCompletion = plugin.doTagComplete(document, Position.create(0, 20));
        assert.strictEqual(tagCompletion, null);
    });

    it('does provide completions outside of moustache tag', async () => {
        const { plugin, document } = setup('<div on:click={bla} >');

        const completions = await plugin.getCompletions(document, Position.create(0, 21));
        assert.deepEqual(completions?.items[0], <CompletionItem>{
            filterText: '</div>',
            insertTextFormat: 2,
            kind: 10,
            label: '</div>',
            textEdit: {
                newText: '$0</div>',
                range: {
                    end: {
                        character: 21,
                        line: 0
                    },
                    start: {
                        character: 21,
                        line: 0
                    }
                }
            }
        });

        const tagCompletion = plugin.doTagComplete(document, Position.create(0, 21));
        assert.strictEqual(tagCompletion, '$0</div>');
    });

    it('does provide lang in completions', async () => {
        const { plugin, document } = setup('<sty');

        const completions = await plugin.getCompletions(document, Position.create(0, 4));
        assert.ok(Array.isArray(completions && completions.items));
        assert.ok(completions!.items.find((item) => item.label === 'style (lang="less")'));
    });

    it('does not provide lang in completions for attributes', async () => {
        const { plugin, document } = setup('<div sty');

        const completions = await plugin.getCompletions(document, Position.create(0, 8));
        assert.ok(Array.isArray(completions && completions.items));
        assert.strictEqual(
            completions!.items.find((item) => item.label === 'style (lang="less")'),
            undefined
        );
    });

    it('skip HTML completions for non-HTML trigger characters', async () => {
        const { plugin, document } = setup('<div><div>');

        const completions = await plugin.getCompletions(document, Position.create(0, 5), {
            triggerCharacter: '>',
            triggerKind: CompletionTriggerKind.TriggerCharacter
        });
        assert.strictEqual(completions, null);
    });

    it('provide emmet completions with >', async () => {
        const { plugin, document } = setup('div>');

        const completions = await plugin.getCompletions(document, Position.create(0, 5), {
            triggerCharacter: '>',
            triggerKind: CompletionTriggerKind.TriggerCharacter
        });
        assert.strictEqual(completions?.items[0]?.label, 'div>');
    });

    it('does not provide rename for element being uppercase', async () => {
        const { plugin, document } = setup('<Div></Div>');

        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 2)), null);
        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 2), 'p'), null);
    });

    it('does not provide rename for valid element but incorrect position #1', () => {
        const { plugin, document } = setup('<div on:click={ab => ab}>asd</div>');
        const newName = 'p';

        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 16)), null);
        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 5)), null);
        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 26)), null);

        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 16), newName), null);
        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 5), newName), null);
        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 26), newName), null);
    });

    it('does not provide rename for valid element but incorrect position #2', () => {
        const { plugin, document } = setup('<svelte:window on:click={ab => ab} />');
        const newName = 'p';

        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 33)), null);
        assert.deepStrictEqual(plugin.prepareRename(document, Position.create(0, 36)), null);

        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 33), newName), null);
        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 36), newName), null);
    });

    it('provides rename for element', () => {
        const { plugin, document } = setup('<div on:click={() => {}}></div>');
        const newName = 'p';

        const pepareRenameInfo = Range.create(Position.create(0, 1), Position.create(0, 4));
        assert.deepStrictEqual(
            plugin.prepareRename(document, Position.create(0, 2)),
            pepareRenameInfo
        );
        assert.deepStrictEqual(
            plugin.prepareRename(document, Position.create(0, 28)),
            pepareRenameInfo
        );

        const renameInfo = {
            changes: {
                [document.uri]: [
                    {
                        newText: 'p',
                        range: {
                            start: { line: 0, character: 1 },
                            end: { line: 0, character: 4 }
                        }
                    },
                    {
                        newText: 'p',
                        range: {
                            start: { line: 0, character: 27 },
                            end: { line: 0, character: 30 }
                        }
                    }
                ]
            }
        };
        assert.deepStrictEqual(plugin.rename(document, Position.create(0, 2), newName), renameInfo);
        assert.deepStrictEqual(
            plugin.rename(document, Position.create(0, 28), newName),
            renameInfo
        );
    });

    it('provides linked editing ranges', async () => {
        const { plugin, document } = setup('<div></div>');

        const ranges = plugin.getLinkedEditingRanges(document, Position.create(0, 3));
        assert.deepStrictEqual(ranges, {
            ranges: [
                { start: { line: 0, character: 1 }, end: { line: 0, character: 4 } },
                { start: { line: 0, character: 7 }, end: { line: 0, character: 10 } }
            ],
            wordPattern:
                '(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\\'\\"\\,\\<\\>\\/\\s]+)'
        });
    });

    it('provides folding range', () => {
        const { plugin, document } = setup('<div>\n  <div>\n  </div>\n  </div>');

        const ranges = plugin.getFoldingRanges(document);
        assert.deepStrictEqual(ranges, <FoldingRange[]>[{ startLine: 0, endLine: 2 }]);
    });

    it('provides folding range for element with arrow function handler', () => {
        const { plugin, document } = setup('<div \non:click={() => {}}\n />');

        const ranges = plugin.getFoldingRanges(document);
        assert.deepStrictEqual(ranges, <FoldingRange[]>[{ startLine: 0, endLine: 1 }]);
    });

    it('provides indent based folding range for template tag', () => {
        const { plugin, document } = setup('<template lang="pug">\np\n  div\n</template>');

        const ranges = plugin.getFoldingRanges(document);
        assert.deepStrictEqual(ranges, <FoldingRange[]>[
            { startLine: 0, endLine: 2 },
            { startLine: 1, endLine: 2 }
        ]);
    });
});
