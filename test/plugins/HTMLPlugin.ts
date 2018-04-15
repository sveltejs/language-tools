import * as assert from 'assert';
import { EventEmitter } from 'events';
import { Range, Position, Hover } from '../../src/api';
import { HTMLPlugin } from '../../src/plugins/HTMLPlugin';
import { TextDocument } from '../../src/lib/documents/TextDocument';

describe('HTML Plugin', () => {
    it('provides hover info', async () => {
        const plugin = new HTMLPlugin();
        const document = new TextDocument('file:///hello.html', '<h1>Hello, world!</h1>');
        const host = new EventEmitter();
        plugin.onRegister(host);
        host.emit('documentChange|pre', document);

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 2)), <Hover>{
            contents: [
                { language: 'html', value: '<h1>' },
                'The h1 element represents a section heading\\.',
            ],
            range: Range.create(0, 1, 0, 3),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
    });
});
