import * as assert from 'assert';
import { Document } from '../../src/documents/Document';

class TextDocument extends Document {
    constructor(public content: string) {
        super();
    }

    getText() {
        return this.content;
    }

    setText(text: string) {
        this.content = text;
    }

    getFilePath(): string | null {
        throw new Error('Method not implemented.');
    }
}

describe('Document', () => {
    it('gets the text length', () => {
        const document = new TextDocument('Hello, world!');
        assert.strictEqual(document.getTextLength(), 13);
    });

    it('updates the text range', () => {
        const document = new TextDocument('Hello, world!');
        document.update('svelte', 7, 12);
        assert.strictEqual(document.getText(), 'Hello, svelte!');
    });

    it('gets the correct position from offset', () => {
        const document = new TextDocument('Hello\nworld\n');
        assert.deepStrictEqual(document.positionAt(1), { line: 0, character: 1 });
        assert.deepStrictEqual(document.positionAt(9), { line: 1, character: 3 });
        assert.deepStrictEqual(document.positionAt(12), { line: 2, character: 0 });
    });

    it('gets the correct offset from position', () => {
        const document = new TextDocument('Hello\nworld\n');
        assert.strictEqual(document.offsetAt({ line: 0, character: 1 }), 1);
        assert.strictEqual(document.offsetAt({ line: 1, character: 3 }), 9);
        assert.strictEqual(document.offsetAt({ line: 2, character: 0 }), 12);
    });

    it('gets the correct position from offset with CRLF', () => {
        const document = new TextDocument('Hello\r\nworld\r\n');
        assert.deepStrictEqual(document.positionAt(1), { line: 0, character: 1 });
        assert.deepStrictEqual(document.positionAt(10), { line: 1, character: 3 });
        assert.deepStrictEqual(document.positionAt(14), { line: 2, character: 0 });
    });

    it('gets the correct offset from position with CRLF', () => {
        const document = new TextDocument('Hello\r\nworld\r\n');
        assert.strictEqual(document.offsetAt({ line: 0, character: 1 }), 1);
        assert.strictEqual(document.offsetAt({ line: 1, character: 3 }), 10);
        assert.strictEqual(document.offsetAt({ line: 2, character: 0 }), 14);
    });

    it('limits the position when offset is out of bounds', () => {
        const document = new TextDocument('Hello\nworld\n');
        assert.deepStrictEqual(document.positionAt(20), { line: 2, character: 0 });
        assert.deepStrictEqual(document.positionAt(-1), { line: 0, character: 0 });
    });

    it('limits the offset when position is out of bounds', () => {
        const document = new TextDocument('Hello\nworld\n');
        assert.strictEqual(document.offsetAt({ line: 5, character: 0 }), 12);
        assert.strictEqual(document.offsetAt({ line: 1, character: 20 }), 12);
        assert.strictEqual(document.offsetAt({ line: -1, character: 0 }), 0);
    });

    it('supports empty contents', () => {
        const document = new TextDocument('');
        assert.strictEqual(document.offsetAt({ line: 0, character: 0 }), 0);
        assert.deepStrictEqual(document.positionAt(0), { line: 0, character: 0 });
    });
});
