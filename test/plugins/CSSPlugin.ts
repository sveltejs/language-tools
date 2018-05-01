import * as assert from 'assert';
import { EventEmitter } from 'events';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextEdit,
} from '../../src/api';
import { TextDocument } from '../../src/lib/documents/TextDocument';
import { CSSPlugin } from '../../src/plugins/CSSPlugin';
import { DocumentFragment } from '../../src/lib/documents/DocumentFragment';

describe('CSS Plugin', () => {
    it('provides hover info', async () => {
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.css', 'h1 {}');
        const host = new EventEmitter();
        plugin.onRegister(host);
        host.emit('documentChange', document);

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 1)), <Hover>{
            contents: [{ language: 'html', value: '<h1>' }],
            range: Range.create(0, 0, 0, 2),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 3)), null);
    });

    it('provides completions', async () => {
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.css', '');
        const host = new EventEmitter();
        plugin.onRegister(host);
        host.emit('documentChange', document);

        const completions = plugin.getCompletions(document, Position.create(0, 0));
        assert.ok(Array.isArray(completions), 'Expected completions to be an array');
        assert.ok(completions.length > 0, 'Expected completions to have length');

        assert.deepStrictEqual(completions[0], <CompletionItem>{
            label: '@charset',
            kind: CompletionItemKind.Keyword,
            documentation: 'Defines character set of the document.',
            textEdit: TextEdit.insert(Position.create(0, 0), '@charset'),
            sortText: 'd',
        });
    });
});
