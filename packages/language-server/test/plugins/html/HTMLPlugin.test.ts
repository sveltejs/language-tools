import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    TextEdit,
    CompletionItemKind,
    InsertTextFormat,
} from 'vscode-languageserver';
import { HTMLPlugin } from '../../../src/plugins';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';

describe('HTML Plugin', () => {
    function setup(content: string) {
        const plugin = new HTMLPlugin();
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        plugin.onRegister(docManager, pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides hover info', async () => {
        const { plugin, document } = setup('<h1>Hello, world!</h1>');

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 2)), <Hover>{
            contents: {
                kind: 'markdown',
                value:
                    '```html\n<h1>\n```\nThe h1 element represents a section heading.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/Heading_Elements)',
            },

            range: Range.create(0, 1, 0, 3),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
    });

    it('provides completions', async () => {
        const { plugin, document } = setup('<');

        const completions = plugin.getCompletions(document, Position.create(0, 1));
        assert.ok(Array.isArray(completions && completions.items));
        assert.ok(completions!.items.length > 0);

        assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
            label: '!DOCTYPE',
            kind: CompletionItemKind.Property,
            documentation: 'A preamble for an HTML document.',
            textEdit: TextEdit.insert(Position.create(0, 1), '!DOCTYPE html>'),
            insertTextFormat: InsertTextFormat.PlainText,
        });
    });

    it('does not provide completions inside of moustache tag', async () => {
        const { plugin, document } = setup('<div on:click={() =>');

        const completions = plugin.getCompletions(document, Position.create(0, 20));
        assert.strictEqual(completions, null);

        const tagCompletion = plugin.doTagComplete(document, Position.create(0, 20));
        assert.strictEqual(tagCompletion, null);
    });

    it('does provide completions outside of moustache tag', async () => {
        const { plugin, document } = setup('<div on:click={bla} >');

        const completions = plugin.getCompletions(document, Position.create(0, 21));
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
                        line: 0,
                    },
                    start: {
                        character: 21,
                        line: 0,
                    },
                },
            },
        });

        const tagCompletion = plugin.doTagComplete(document, Position.create(0, 21));
        assert.strictEqual(tagCompletion, '$0</div>');
    });
});
