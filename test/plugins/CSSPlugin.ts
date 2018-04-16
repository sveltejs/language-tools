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
        const document = new TextDocument('file:///hello.html', '<style>h1 {}</style>');
        document.addFragment(
            new DocumentFragment(document, {
                start: 7,
                end: 12,
                attributes: { tag: 'style' },
            }),
        );
        const host = new EventEmitter();
        plugin.onRegister(host);
        host.emit('documentChange|pre', document);

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 8)), <Hover>{
            contents: [{ language: 'html', value: '<h1>' }],
            range: Range.create(0, 7, 0, 9),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
    });

    it('provides completions', async () => {
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.html', '<style></style>');
        document.addFragment(
            new DocumentFragment(document, {
                start: 7,
                end: 7,
                attributes: { tag: 'style' },
            }),
        );
        const host = new EventEmitter();
        plugin.onRegister(host);
        host.emit('documentChange|pre', document);

        const completions = plugin.getCompletions(document, Position.create(0, 7));
        assert.ok(Array.isArray(completions), 'Expected completions to be an array');
        assert.ok(completions.length > 0, 'Expected completions to have length');
        console.log(completions[0]);
        assert.deepStrictEqual(completions[0], <CompletionItem>{
            label: '@charset',
            kind: CompletionItemKind.Keyword,
            documentation: 'Defines character set of the document.',
            textEdit: TextEdit.insert(Position.create(0, 7), '@charset'),
            sortText: 'd',
        });
    });
});
