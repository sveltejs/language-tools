import * as assert from 'assert';
import { EventEmitter } from 'events';
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

describe('CSS Plugin', () => {
    it('provides hover info', async () => {
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.css', 'h1 {}');
        const host = Object.assign(new EventEmitter(), {
            getConfig() {
                return true;
            },
        });
        plugin.onRegister(host as any);
        host.emit('documentChange', document);

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
        const plugin = new CSSPlugin();
        const document = new TextDocument('file:///hello.css', '');
        const host = Object.assign(new EventEmitter(), {
            getConfig() {
                return true;
            },
        });
        plugin.onRegister(host as any);
        host.emit('documentChange', document);

        const completions = plugin.getCompletions(document, Position.create(0, 0), " ");
        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completions to be an array',
        );
        assert.ok(completions!.items.length > 0, 'Expected completions to have length');

        assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
            label: '@charset',
            kind: CompletionItemKind.Keyword,
            documentation:
                'Defines character set of the document.\n(Firefox 1, Safari 4, Chrome 2, IE 5, Opera 9)',
            textEdit: TextEdit.insert(Position.create(0, 0), '@charset'),
            sortText: 'd',
        });
    });
});
