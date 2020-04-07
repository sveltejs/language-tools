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
});
