import * as assert from 'assert';
import { SvelteDocument } from '../../../src/lib/documents/SvelteDocument';

describe('Svelte Document', () => {
    it('gets the correct text', () => {
        const document = new SvelteDocument('file:///hello.html', '<h1>Hello, world!</h1>');
        assert.strictEqual(document.getText(), '<h1>Hello, world!</h1>');
    });

    it('sets the text', () => {
        const document = new SvelteDocument('file:///hello.html', '<h1>Hello, world!</h1>');
        document.setText('<h1>Hello, svelte!</h1>');
        assert.strictEqual(document.getText(), '<h1>Hello, svelte!</h1>');
    });

    const component = new SvelteDocument(
        'file:///hello.html',
        `
        <h1 on:click="hello()">Hello, world!</h1>
        <style type="text/css">
            h1 {
                font-size: 28px;
            }
        </style>
        <script type="text/javascript">
            export default {
                methods: {
                    hello() {
                        alert('Hello, world!');
                    }
                }
            }
        </script>
    `,
    );

    it('extracts the styles', () => {
        assert.strictEqual(component.style.details.start, 82);
        assert.strictEqual(component.style.details.end, 155);
        assert.deepStrictEqual(component.style.details.attributes, {
            tag: 'style',
            type: 'text/css',
        });
    });

    it('extracts the script', () => {
        assert.strictEqual(component.script.details.start, 203);
        assert.strictEqual(component.script.details.end, 400);
        assert.deepStrictEqual(component.script.details.attributes, {
            tag: 'script',
            type: 'text/javascript',
        });
    });

    it('defaults fragment to the end of the component if not found', () => {
        const document = new SvelteDocument('file:///hello.html', '<h1>Hello, world</h1>');
        assert.strictEqual(document.script.details.start, 21);
        assert.strictEqual(document.script.details.end, 21);
        assert.deepStrictEqual(document.script.details.attributes, { tag: 'script' });
        assert.strictEqual(document.style.details.start, 21);
        assert.strictEqual(document.style.details.end, 21);
        assert.deepStrictEqual(document.style.details.attributes, { tag: 'style' });
    });

    it('supports boolean attributes', () => {
        const document = new SvelteDocument('file:///hello.html', '<style test></style>');
        assert.deepStrictEqual(document.style.details.attributes, { tag: 'style', test: 'test' });
    });

    it('supports unquoted attributes', () => {
        const document = new SvelteDocument('file:///hello.html', '<style type=text/css></style>');
        assert.deepStrictEqual(document.style.details.attributes, {
            tag: 'style',
            type: 'text/css',
        });
    });

    it('increments the version on edits', () => {
        const document = new SvelteDocument('file:///hello.html', 'hello');
        assert.strictEqual(document.version, 0);

        document.setText('Hello, world!');
        assert.strictEqual(document.version, 1);
        document.update('svelte', 7, 12);
        assert.strictEqual(document.version, 2);
    });

    it('returns the correct file path', () => {
        const document = new SvelteDocument('file:///hello.html', 'hello');

        assert.strictEqual(document.getFilePath(), '/hello.html');
    });

    it('returns null for non file urls', () => {
        const document = new SvelteDocument('ftp:///hello.html', 'hello');

        assert.strictEqual(document.getFilePath(), null);
    });
});
