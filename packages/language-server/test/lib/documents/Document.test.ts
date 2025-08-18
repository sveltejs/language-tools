import { describe, it, expect } from 'vitest';
import { Document } from '../../../src/lib/documents';
import { Position } from 'vscode-languageserver';

describe('Document', () => {
    it('gets the correct text', () => {
        const document = new Document('file:///hello.svelte', '<h1>Hello, world!</h1>');
        expect(document.getText()).toEqual('<h1>Hello, world!</h1>');
    });

    it('sets the text', () => {
        const document = new Document('file:///hello.svelte', '<h1>Hello, world!</h1>');
        document.setText('<h1>Hello, svelte!</h1>');
        expect(document.getText()).toEqual('<h1>Hello, svelte!</h1>');
    });

    it('increments the version on edits', () => {
        const document = new Document('file:///hello.svelte', 'hello');
        expect(document.version).toEqual(0);

        document.setText('Hello, world!');
        expect(document.version).toEqual(1);
        document.update('svelte', 7, 12);
        expect(document.version).toEqual(2);
    });

    it('recalculates the tag infos on edits', () => {
        const document = new Document('file:///hello.svelte', '<script>a</script><style>b</style>');
        expect(document.scriptInfo).toEqual({
            content: 'a',
            attributes: {},
            start: 8,
            end: 9,
            startPos: Position.create(0, 8),
            endPos: Position.create(0, 9),
            container: { start: 0, end: 18 }
        });
        expect(document.styleInfo).toEqual({
            content: 'b',
            attributes: {},
            start: 25,
            end: 26,
            startPos: Position.create(0, 25),
            endPos: Position.create(0, 26),
            container: { start: 18, end: 34 }
        });

        document.setText('<script>b</script>');
        expect(document.scriptInfo).toEqual({
            content: 'b',
            attributes: {},
            start: 8,
            end: 9,
            startPos: Position.create(0, 8),
            endPos: Position.create(0, 9),
            container: { start: 0, end: 18 }
        });
        expect(document.styleInfo).toEqual(null);
    });

    it('returns the correct file path', () => {
        const document = new Document('file:///hello.svelte', 'hello');

        expect(document.getFilePath()).toEqual('/hello.svelte');
    });

    it('returns null for non file urls', () => {
        const document = new Document('ftp:///hello.svelte', 'hello');

        expect(document.getFilePath()).toEqual(null);
    });

    it('gets the text length', () => {
        const document = new Document('file:///hello.svelte', 'Hello, world!');
        expect(document.getTextLength()).toEqual(13);
    });

    it('updates the text range', () => {
        const document = new Document('file:///hello.svelte', 'Hello, world!');
        document.update('svelte', 7, 12);
        expect(document.getText()).toEqual('Hello, svelte!');
    });

    it('gets the correct position from offset', () => {
        const document = new Document('file:///hello.svelte', 'Hello\nworld\n');
        expect(document.positionAt(1)).toEqual({ line: 0, character: 1 });
        expect(document.positionAt(9)).toEqual({ line: 1, character: 3 });
        expect(document.positionAt(12)).toEqual({ line: 2, character: 0 });
    });

    it('gets the correct offset from position', () => {
        const document = new Document('file:///hello.svelte', 'Hello\nworld\n');
        expect(document.offsetAt({ line: 0, character: 1 })).toBe(1);
        expect(document.offsetAt({ line: 1, character: 3 })).toBe(9);
        expect(document.offsetAt({ line: 2, character: 0 })).toBe(12);
    });

    it('gets the correct position from offset with CRLF', () => {
        const document = new Document('file:///hello.svelte', 'Hello\r\nworld\r\n');
        expect(document.positionAt(1)).toEqual({ line: 0, character: 1 });
        expect(document.positionAt(10)).toEqual({ line: 1, character: 3 });
        expect(document.positionAt(14)).toEqual({ line: 2, character: 0 });
    });

    it('gets the correct offset from position with CRLF', () => {
        const document = new Document('file:///hello.svelte', 'Hello\r\nworld\r\n');
        expect(document.offsetAt({ line: 0, character: 1 })).toEqual(1);
        expect(document.offsetAt({ line: 1, character: 3 })).toEqual(10);
        expect(document.offsetAt({ line: 2, character: 0 })).toEqual(14);
    });

    it('limits the position when offset is out of bounds', () => {
        const document = new Document('file:///hello.svelte', 'Hello\nworld\n');
        expect(document.positionAt(20)).toEqual({ line: 2, character: 0 });
        expect(document.positionAt(-1)).toEqual({ line: 0, character: 0 });
    });

    it('limits the offset when position is out of bounds', () => {
        const document = new Document('file:///hello.svelte', 'Hello\nworld\n');
        expect(document.offsetAt({ line: 5, character: 0 })).toEqual(12);
        expect(document.offsetAt({ line: 1, character: 20 })).toEqual(12);
        expect(document.offsetAt({ line: -1, character: 0 })).toEqual(0);
    });

    it('supports empty contents', () => {
        const document = new Document('file:///hello.svelte', '');
        expect(document.offsetAt({ line: 0, character: 0 })).toEqual(0);
        expect(document.positionAt(0)).toEqual({ line: 0, character: 0 });
    });
});
