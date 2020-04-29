import * as assert from 'assert';
import { ManagedDocument } from '../../../src/lib/documents';

describe('ManagedDocument', () => {
    it('gets the correct text', () => {
        const document = new ManagedDocument('file:///hello.svelte', '<h1>Hello, world!</h1>');
        assert.strictEqual(document.getText(), '<h1>Hello, world!</h1>');
    });

    it('sets the text', () => {
        const document = new ManagedDocument('file:///hello.svelte', '<h1>Hello, world!</h1>');
        document.setText('<h1>Hello, svelte!</h1>');
        assert.strictEqual(document.getText(), '<h1>Hello, svelte!</h1>');
    });

    it('increments the version on edits', () => {
        const document = new ManagedDocument('file:///hello.svelte', 'hello');
        assert.strictEqual(document.version, 0);

        document.setText('Hello, world!');
        assert.strictEqual(document.version, 1);
        document.update('svelte', 7, 12);
        assert.strictEqual(document.version, 2);
    });

    it('returns the correct file path', () => {
        const document = new ManagedDocument('file:///hello.svelte', 'hello');

        assert.strictEqual(document.getFilePath(), '/hello.svelte');
    });

    it('returns null for non file urls', () => {
        const document = new ManagedDocument('ftp:///hello.svelte', 'hello');

        assert.strictEqual(document.getFilePath(), null);
    });
});
