import * as assert from 'assert';
import { EventEmitter } from 'events';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    TextEdit,
    CompletionItemKind,
    InsertTextFormat,
} from '../../src/api';
import { HTMLPlugin } from '../../src/plugins/HTMLPlugin';
import { TextDocument } from '../../src/lib/documents/TextDocument';

describe('HTML Plugin', () => {
    it('provides hover info', async () => {
        const plugin = new HTMLPlugin();
        const document = new TextDocument('file:///hello.html', '<h1>Hello, world!</h1>');
        const host = Object.assign(new EventEmitter(), {
            getConfig() {
                return true;
            },
        });
        plugin.onRegister(host as any);
        host.emit('documentChange|pre', document);

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
        const plugin = new HTMLPlugin();
        const document = new TextDocument('file:///hello.html', '<');
        const host = Object.assign(new EventEmitter(), {
            getConfig() {
                return true;
            },
        });
        plugin.onRegister(host as any);
        host.emit('documentChange|pre', document);

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
});
