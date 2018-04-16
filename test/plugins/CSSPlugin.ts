import * as assert from 'assert';
import { EventEmitter } from 'events';
import { Range, Position, Hover } from '../../src/api';
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
            range: Range.create(0, 0, 0, 2),
        });

        assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
    });
});
