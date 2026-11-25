import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAtDollarIdentifier, timedOut, withTimeout } from '../src/typescript-go/middleware/utils';

describe('tsgo middleware: withTimeout', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves with the result if it comes in time', async () => {
        expect(await withTimeout(Promise.resolve('result'), 1000)).toBe('result');
    });

    it('keeps a null result apart from a timeout', async () => {
        expect(await withTimeout(Promise.resolve(null), 1000)).toBe(null);
    });

    it('resolves with `timedOut` when the time ran out', async () => {
        vi.useFakeTimers();
        const pending = withTimeout(new Promise(() => {}), 1000);
        await vi.advanceTimersByTimeAsync(1000);
        expect(await pending).toBe(timedOut);
    });

    it('rejects if the promise rejects, and leaves no timer behind', async () => {
        vi.useFakeTimers();
        await expect(withTimeout(Promise.reject(new Error('failed')), 1000)).rejects.toThrow(
            'failed'
        );
        expect(vi.getTimerCount()).toBe(0);

        await withTimeout(Promise.resolve(1), 1000);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('tsgo middleware: isAtDollarIdentifier', () => {
    /** `|` marks the position */
    function at(marked: string) {
        const offset = marked.indexOf('|');
        const text = marked.replace('|', '');
        const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index! + 1)];
        const document = {
            getText: () => text,
            offsetAt: (p: { line: number; character: number }) => lineStarts[p.line] + p.character,
            positionAt: (o: number) => {
                const line = lineStarts.filter((start) => start <= o).length - 1;
                return { line, character: o - lineStarts[line] };
            }
        };
        return isAtDollarIdentifier(document, document.positionAt(offset));
    }

    it('finds `$name` at its start, inside and at its end', () => {
        expect(at('<p>{|$count}</p>')).toBe(true);
        expect(at('<p>{$co|unt}</p>')).toBe(true);
        expect(at('<p>{$count|}</p>')).toBe(true);
        expect(at('<script>\n  $count| += 1;\n</script>')).toBe(true);
        expect(at('{$größ|e}')).toBe(true);
    });

    it('also finds `$name` that is no store, which the language server sorts out', () => {
        expect(at('{component.$o|n}')).toBe(true);
    });

    it('rejects other identifiers', () => {
        expect(at('<p>{co|unt}</p>')).toBe(false);
        expect(at('<p>{$count.val|ue}</p>')).toBe(false);
        expect(at('<p>{pre$fi|x}</p>')).toBe(false);
        expect(at('<p>{`${na|me}`}</p>')).toBe(false);
        expect(at('<p>{$count} |text</p>')).toBe(false);
    });

    it('rejects `$$props` and friends', () => {
        expect(at('{$$pro|ps.a}')).toBe(false);
        expect(at('{|$$restProps}')).toBe(false);
    });
});
