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
    assert.ok(
        range.span.start + range.span.length <= oldText.length,
        `${label ? label + ': ' : ''}Span exceeds old text length`
    );
    assert.ok(
        range.span.start + range.newLength <= newText.length,
        `${label ? label + ': ' : ''}New length exceeds new text length`
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

    it('detects insertion at the start', () => {
        const range = assertValidChangeRange('world', 'hello world');
        assert.deepStrictEqual(range, {
            span: { start: 0, length: 0 },
            newLength: 6
        });
    });

    it('detects deletion in the middle', () => {
        const range = assertValidChangeRange('hello beautiful world', 'hello world');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 10 },
            newLength: 0
        });
    });

    it('detects deletion at the start', () => {
        const range = assertValidChangeRange('hello world', 'world');
        assert.deepStrictEqual(range, {
            span: { start: 0, length: 6 },
            newLength: 0
        });
    });

    it('detects same-length replacement in the middle', () => {
        const range = assertValidChangeRange('hello world', 'hello earth');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 5 },
            newLength: 5
        });
    });

    it('detects shorter replacement', () => {
        const range = assertValidChangeRange('hello world', 'hello hi');
        assert.deepStrictEqual(range, {
            span: { start: 6, length: 5 },
            newLength: 2
        });
    });

    it('handles repeated characters at boundaries', () => {
        const range = assertValidChangeRange('aaa', 'aaaa');
        assert.strictEqual(range.span.length, 0);
        assert.strictEqual(range.newLength, 1);
    });

    it('handles change where prefix and suffix overlap would be wrong', () => {
        assertValidChangeRange('abab', 'ab');
    });

    it('handles multiline text with change on one line', () => {
        const old = 'line1\nline2\nline3\nline4';
        const new_ = 'line1\nmodified\nline3\nline4';
        assertValidChangeRange(old, new_);
    });

    it('handles adding a line in the middle', () => {
        assertValidChangeRange('line1\nline3', 'line1\nline2\nline3');
    });

    it('handles adding an import statement', () => {
        const old = `import { a } from 'module';\n\nconst x = a();`;
        const new_ = `import { a } from 'module';\nimport { b } from 'other';\n\nconst x = a();`;
        assertValidChangeRange(old, new_);
    });

    it('handles renaming a variable', () => {
        const old = `const foo = 1;\nconsole.log(foo);`;
        const new_ = `const bar = 1;\nconsole.log(bar);`;
        assertValidChangeRange(old, new_);
    });

    it('handles typing one character at a time', () => {
        let text = '';
        for (const char of 'const x = 42;') {
            const newText = text + char;
            assertValidChangeRange(text, newText, `typing '${char}'`);
            text = newText;
        }
    });

    it('handles single-char change in large text', () => {
        const old = 'a'.repeat(50_000) + 'X' + 'b'.repeat(50_000);
        const new_ = 'a'.repeat(50_000) + 'Y' + 'b'.repeat(50_000);
        const range = assertValidChangeRange(old, new_);
        assert.strictEqual(range.span.start, 50_000);
        assert.strictEqual(range.span.length, 1);
        assert.strictEqual(range.newLength, 1);
    });

    it('handles large insertion in middle', () => {
        const prefix = 'a'.repeat(10_000);
        const suffix = 'b'.repeat(10_000);
        const insertion = 'c'.repeat(50_000);
        const range = assertValidChangeRange(prefix + suffix, prefix + insertion + suffix);
        assert.strictEqual(range.span.start, 10_000);
        assert.strictEqual(range.span.length, 0);
        assert.strictEqual(range.newLength, 50_000);
    });

    it('holds reconstruction invariant for diverse edit patterns', () => {
        const cases: [string, string][] = [
            ['const x = 1;', 'const x = 42;'],
            ['function foo() {}', 'function fooBar() {}'],
            ['import { a } from "b"', 'import { a, c } from "b"'],
            ['line1\nline2\nline3', 'line1\nmodified\nline3'],
            ['abcdef', 'abcxyzdef'],
            ['abcxyzdef', 'abcdef'],
            ['', ''],
            ['', 'x'],
            ['x', ''],
            ['x', 'x'],
            ['a', 'b'],
            ['a\nb\nc', 'a\nB\nc'],
            ['a\nb\nc', 'a\nc'],
            ['a\nc', 'a\nb\nc'],
            ['the quick brown fox', 'the slow brown fox'],
            ['abcdefghij', 'abcXYZhij'],
            ['prefix_middle_suffix', 'prefix_changed_suffix'],
            ['prefix_middle_suffix', 'prefix_suffix'],
            ['prefix_suffix', 'prefix_middle_suffix']
        ];

        for (const [oldText, newText] of cases) {
            assertValidChangeRange(oldText, newText, `'${oldText}' -> '${newText}'`);
        }
    });
});

describe('JSOrTSDocumentSnapshot.getChangeRange', () => {
    function createSnapshot(text: string, version = 0, filePath = '/test/file.ts') {
        return new JSOrTSDocumentSnapshot(version, filePath, text);
    }

    describe('between different snapshots', () => {
        it('computes change range between two different snapshots', () => {
            const old = createSnapshot('const x = 1;');
            const current = createSnapshot('const x = 42;');
            const range = current.getChangeRange(old);
            assert.ok(range);
            assert.deepStrictEqual(range.span.start, 10);
            assert.deepStrictEqual(range.span.length, 1);
            assert.deepStrictEqual(range.newLength, 2);
        });

        it('computes change range when old snapshot is empty', () => {
            const old = createSnapshot('');
            const current = createSnapshot('const x = 1;');
            const range = current.getChangeRange(old);
            assert.ok(range);
            assert.deepStrictEqual(range.span.start, 0);
            assert.deepStrictEqual(range.span.length, 0);
            assert.deepStrictEqual(range.newLength, current.getLength());
        });

        it('computes change range when new snapshot is empty', () => {
            const old = createSnapshot('const x = 1;');
            const current = createSnapshot('');
            const range = current.getChangeRange(old);
            assert.ok(range);
            assert.deepStrictEqual(range.span.start, 0);
            assert.deepStrictEqual(range.span.length, old.getLength());
            assert.deepStrictEqual(range.newLength, 0);
        });

        it('returns empty change for identical snapshots', () => {
            const old = createSnapshot('const x = 1;');
            const current = createSnapshot('const x = 1;');
            const range = current.getChangeRange(old);
            assert.ok(range);
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 0);
        });

        it('reconstructs correctly for multiline snapshot change', () => {
            const oldText = 'import { a } from "mod";\n\nconst x = a();\n';
            const newText = 'import { a, b } from "mod";\n\nconst x = a();\nconst y = b();\n';
            const old = createSnapshot(oldText);
            const current = createSnapshot(newText);
            const range = current.getChangeRange(old);
            assert.ok(range);
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });
    });

    describe('in-place update (self-reference)', () => {
        it('returns pre-computed change range after update', () => {
            const snapshot = createSnapshot('const x = 1;');
            const oldText = snapshot.getFullText();

            snapshot.update([
                {
                    range: {
                        start: { line: 0, character: 10 },
                        end: { line: 0, character: 11 }
                    },
                    text: '42'
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range, 'Should return a change range for self-reference after update');

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('returns undefined for self-reference before any update', () => {
            const snapshot = createSnapshot('const x = 1;');
            const range = snapshot.getChangeRange(snapshot);
            assert.strictEqual(range, undefined);
        });

        it('handles full text replacement via update without range', () => {
            const snapshot = createSnapshot('const x = 1;');
            const oldText = snapshot.getFullText();
            snapshot.update([{ text: 'const y = 2;' }]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range, 'Should have change range after full replacement');

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('increments version after update', () => {
            const snapshot = createSnapshot('x', 5);
            assert.strictEqual(snapshot.version, 5);
            snapshot.update([{ text: 'y' }]);
            assert.strictEqual(snapshot.version, 6);
        });

        it('simulates rapid typing: many sequential single-char updates', () => {
            const snapshot = createSnapshot('const x = ;');
            const typedChars = '42 + 8';

            for (let i = 0; i < typedChars.length; i++) {
                const oldText = snapshot.getFullText();
                snapshot.update([
                    {
                        range: {
                            start: { line: 0, character: 10 + i },
                            end: { line: 0, character: 10 + i }
                        },
                        text: typedChars[i]
                    }
                ]);

                const range = snapshot.getChangeRange(snapshot);
                assert.ok(range, `Should have range after typing char ${i}: '${typedChars[i]}'`);

                const newText = snapshot.getFullText();
                const before = oldText.substring(0, range.span.start);
                const after = oldText.substring(range.span.start + range.span.length);
                const inserted = newText.substring(
                    range.span.start,
                    range.span.start + range.newLength
                );
                assert.strictEqual(
                    before + inserted + after,
                    newText,
                    `Reconstruction failed at char ${i}`
                );
            }

            assert.strictEqual(snapshot.getFullText(), 'const x = 42 + 8;');
        });
    });
});

describe('SvelteDocumentSnapshot.getChangeRange', () => {
    function createSvelteSnapshot(generatedText: string, originalText?: string) {
        const uri = pathToUrl('/test/Component.svelte');
        const doc = new Document(uri, originalText ?? generatedText);
        return new SvelteDocumentSnapshot(
            doc,
            null, // parserError
            ts.ScriptKind.TS,
            '4.0.0', // svelteVersion
            generatedText,
            0, // nrPrependedLines
            { has: () => false } // exportedNames
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

    it('returns empty change for identical snapshots', () => {
        const old = createSvelteSnapshot('let x = 1;');
        const current = createSvelteSnapshot('let x = 1;');

        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.strictEqual(range.span.length, 0);
        assert.strictEqual(range.newLength, 0);
    });

    it('handles large generated text with small change', () => {
        const base = 'const x' + '= 1;\n'.repeat(1000);
        const old = createSvelteSnapshot(base + 'let final = 0;');
        const current = createSvelteSnapshot(base + 'let final = 999;');

        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.ok(range.span.start >= base.length);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles many sequential snapshots (simulating repeated edits)', () => {
        const versions = [
            'let count = 0;',
            'let count = 0;\nlet name = "";',
            'let count = 0;\nlet name = "world";',
            'let count = 0;\nlet name = "world";\nfunction greet() { return name; }',
            'let count = 1;\nlet name = "world";\nfunction greet() { return name; }'
        ];

        for (let i = 1; i < versions.length; i++) {
            const old = createSvelteSnapshot(versions[i - 1]);
            const current = createSvelteSnapshot(versions[i]);
            const range = current.getChangeRange(old);
            assert.ok(range, `Should have range for version ${i - 1} -> ${i}`);

            const oldText = old.getFullText();
            const newText = current.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(
                before + inserted + after,
                newText,
                `Reconstruction failed for version ${i - 1} -> ${i}`
            );
        }
    });
});
