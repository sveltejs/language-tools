import * as assert from 'assert';
import ts from 'typescript';
import {
    computeChangeRange,
    JSOrTSDocumentSnapshot,
    SvelteDocumentSnapshot
} from '../../../src/plugins/typescript/DocumentSnapshot';
import { Document } from '../../../src/lib/documents';
import { pathToUrl } from '../../../src/utils';

/**
 * Helper: verifies the reconstruction invariant for computeChangeRange.
 * Given old and new text, the change range should allow reconstructing
 * the new text by splicing the changed portion into the old text.
 */
function assertValidChangeRange(oldText: string, newText: string, label?: string) {
    const range = computeChangeRange(oldText, newText);
    const before = oldText.substring(0, range.span.start);
    const after = oldText.substring(range.span.start + range.span.length);
    const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
    const reconstructed = before + inserted + after;
    assert.strictEqual(
        reconstructed,
        newText,
        `${label ? label + ': ' : ''}Reconstruction failed for change ` +
            `span(${range.span.start}, ${range.span.length}), newLength=${range.newLength}`
    );
    return range;
}

describe('computeChangeRange', () => {
    it('returns empty change range for identical texts', () => {
        const result = computeChangeRange('hello world', 'hello world');
        assert.deepStrictEqual(result, {
            span: { start: 11, length: 0 },
            newLength: 0
        });
    });

    it('detects insertion in the middle', () => {
        const range = assertValidChangeRange('hello world', 'hello beautiful world');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 0 },
            newLength: 10
        });
    });

    it('detects deletion in the middle', () => {
        const range = assertValidChangeRange('hello beautiful world', 'hello world');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 10 },
            newLength: 0
        });
    });

    it('detects replacement', () => {
        const range = assertValidChangeRange('hello world', 'hello earth');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 5 },
            newLength: 5
        });
    });

    it('handles multiline text with change on one line', () => {
        assertValidChangeRange('line1\nline2\nline3\nline4', 'line1\nmodified\nline3\nline4');
    });

    it('holds reconstruction invariant for diverse edit patterns', () => {
        const cases: [string, string][] = [
            ['', 'x'],
            ['x', ''],
            ['abcdef', 'abcxyzdef'],
            ['abcxyzdef', 'abcdef'],
            ['prefix_middle_suffix', 'prefix_changed_suffix'],
            ['aaa', 'aaaa']
        ];

        for (const [oldText, newText] of cases) {
            assertValidChangeRange(oldText, newText, `'${oldText}' -> '${newText}'`);
        }
    });
});

describe('JSOrTSDocumentSnapshot.getChangeRange', () => {
    function createSnapshot(text: string, version = 0, filePath = '/test/file.ts') {
        return new JSOrTSDocumentSnapshot(ts, version, filePath, text);
    }

    it('computes change range between two different snapshots', () => {
        const old = createSnapshot('const x = 1;');
        const current = createSnapshot('const x = 42;');
        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.deepStrictEqual(range.span.start, 10);
        assert.deepStrictEqual(range.span.length, 1);
        assert.deepStrictEqual(range.newLength, 2);
    });

    it('returns empty change for identical snapshots', () => {
        const old = createSnapshot('const x = 1;');
        const current = createSnapshot('const x = 1;');
        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.strictEqual(range.span.length, 0);
        assert.strictEqual(range.newLength, 0);
    });

    it('update returns a new snapshot with correct change range', () => {
        const original = createSnapshot('const x = 1;');
        const updated = original.update([
            {
                range: {
                    start: { line: 0, character: 10 },
                    end: { line: 0, character: 11 }
                },
                text: '42'
            }
        ]);

        assert.notStrictEqual(original, updated, 'update should return a new snapshot');
        assert.strictEqual(updated.getFullText(), 'const x = 42;');
        assert.strictEqual(updated.version, original.version + 1);

        const range = updated.getChangeRange(original);
        assert.ok(range);

        const oldText = original.getFullText();
        const newText = updated.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });
});

describe('SvelteDocumentSnapshot.getChangeRange', () => {
    function createSvelteSnapshot(
        generatedText: string,
        options?: { scriptKind?: ts.ScriptKind; parserError?: boolean }
    ) {
        const uri = pathToUrl('/test/Component.svelte');
        const doc = new Document(uri, generatedText);
        return new SvelteDocumentSnapshot(
            doc,
            options?.parserError
                ? {
                      message: 'error',
                      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                      code: -1
                  }
                : null,
            options?.scriptKind ?? ts.ScriptKind.TS,
            '4.0.0',
            generatedText,
            0,
            { has: () => false }
        );
    }

    it('computes change range between two svelte snapshots', () => {
        const old = createSvelteSnapshot('let x = 1;');
        const current = createSvelteSnapshot('let x = 42;');

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('returns undefined when scriptKind changes', () => {
        const old = createSvelteSnapshot('let x = 1;', { scriptKind: ts.ScriptKind.JS });
        const current = createSvelteSnapshot('let x = 1;', { scriptKind: ts.ScriptKind.TS });

        const range = current.getChangeRange(old);
        assert.strictEqual(range, undefined);
    });

    it('returns undefined when parserError state changes', () => {
        const old = createSvelteSnapshot('let x = 1;', { parserError: false });
        const current = createSvelteSnapshot('let x = 1;', { parserError: true });

        const range = current.getChangeRange(old);
        assert.strictEqual(range, undefined);
    });
});
