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
    // The span must not extend beyond the old text
    assert.ok(
        range.span.start + range.span.length <= oldText.length,
        `${label ? label + ': ' : ''}Span exceeds old text length`
    );
    // The new region must not extend beyond the new text
    assert.ok(
        range.span.start + range.newLength <= newText.length,
        `${label ? label + ': ' : ''}New length exceeds new text length`
    );
    return range;
}

describe('computeChangeRange', () => {
    describe('identical texts', () => {
        it('returns empty change range for identical texts', () => {
            const result = computeChangeRange('hello world', 'hello world');
            assert.deepStrictEqual(result, {
                span: { start: 11, length: 0 },
                newLength: 0
            });
        });

        it('returns empty change range for single character', () => {
            const result = computeChangeRange('x', 'x');
            assert.deepStrictEqual(result, {
                span: { start: 1, length: 0 },
                newLength: 0
            });
        });

        it('returns empty change range for both empty', () => {
            const result = computeChangeRange('', '');
            assert.deepStrictEqual(result, {
                span: { start: 0, length: 0 },
                newLength: 0
            });
        });
    });

    describe('insertions', () => {
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

        it('detects insertion at the end', () => {
            const range = assertValidChangeRange('hello', 'hello world');
            assert.deepStrictEqual(range, {
                span: { start: 5, length: 0 },
                newLength: 6
            });
        });

        it('detects single character insertion', () => {
            const range = assertValidChangeRange('ab', 'axb');
            assert.deepStrictEqual(range, {
                span: { start: 1, length: 0 },
                newLength: 1
            });
        });

        it('detects inserting into empty string', () => {
            const range = assertValidChangeRange('', 'hello');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 0 },
                newLength: 5
            });
        });

        it('detects newline insertion', () => {
            const range = assertValidChangeRange('line1\nline2', 'line1\n\nline2');
            assert.deepStrictEqual(range, {
                span: { start: 6, length: 0 },
                newLength: 1
            });
        });
    });

    describe('deletions', () => {
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

        it('detects deletion at the end', () => {
            const range = assertValidChangeRange('hello world', 'hello');
            assert.deepStrictEqual(range, {
                span: { start: 5, length: 6 },
                newLength: 0
            });
        });

        it('detects single character deletion', () => {
            const range = assertValidChangeRange('axb', 'ab');
            assert.deepStrictEqual(range, {
                span: { start: 1, length: 1 },
                newLength: 0
            });
        });

        it('detects deleting to empty string', () => {
            const range = assertValidChangeRange('hello', '');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 5 },
                newLength: 0
            });
        });

        it('detects deleting entire line', () => {
            // 'line1\nline2\nline3' -> 'line1\nline3'
            // prefix: 'line1\nline' (10 chars, since old[10]='2' != new[10]='3')
            // suffix scan stops early due to prefix overlap constraint
            const range = assertValidChangeRange('line1\nline2\nline3', 'line1\nline3');
            assert.strictEqual(range.newLength, 0);
            assert.strictEqual(range.span.length, 6);
        });
    });

    describe('replacements', () => {
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

        it('detects longer replacement', () => {
            const range = assertValidChangeRange('hello hi', 'hello world');
            assert.deepStrictEqual(range, {
                span: { start: 6, length: 2 },
                newLength: 5
            });
        });

        it('detects replacement at the start', () => {
            const range = assertValidChangeRange('abc def', 'xyz def');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 3 },
                newLength: 3
            });
        });

        it('detects replacement at the end', () => {
            const range = assertValidChangeRange('hello abc', 'hello xyz');
            assert.deepStrictEqual(range, {
                span: { start: 6, length: 3 },
                newLength: 3
            });
        });

        it('detects completely different texts', () => {
            const range = assertValidChangeRange('abc', 'xyz');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 3 },
                newLength: 3
            });
        });

        it('detects single character change', () => {
            const range = assertValidChangeRange('cat', 'cut');
            assert.deepStrictEqual(range, {
                span: { start: 1, length: 1 },
                newLength: 1
            });
        });
    });

    describe('repeated / ambiguous characters', () => {
        it('handles repeated characters at boundaries', () => {
            // 'aaa' -> 'aaaa': the suffix scanner could match greedily
            const range = assertValidChangeRange('aaa', 'aaaa');
            // Should detect insertion of one 'a' somewhere
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 1);
        });

        it('handles deletion of repeated character', () => {
            const range = assertValidChangeRange('aaaa', 'aaa');
            assert.strictEqual(range.span.length, 1);
            assert.strictEqual(range.newLength, 0);
        });

        it('handles change surrounded by identical characters', () => {
            // The change is the middle 'X' vs 'Y', but surrounded by 'aaa' on both sides
            assertValidChangeRange('aaaXaaa', 'aaaYaaa');
        });

        it('handles change where prefix and suffix overlap would be wrong', () => {
            // 'abab' -> 'ab': naive suffix matching could overlap with prefix
            assertValidChangeRange('abab', 'ab');
        });

        it('handles insertion of text identical to surrounding context', () => {
            assertValidChangeRange('abcabc', 'abcabcabc');
        });
    });

    describe('multiline and whitespace', () => {
        it('handles multiline text with change on one line', () => {
            const old = 'line1\nline2\nline3\nline4';
            const new_ = 'line1\nmodified\nline3\nline4';
            assertValidChangeRange(old, new_);
        });

        it('handles adding a new line at the end', () => {
            assertValidChangeRange('line1\nline2', 'line1\nline2\nline3');
        });

        it('handles removing the last line', () => {
            assertValidChangeRange('line1\nline2\nline3', 'line1\nline2');
        });

        it('handles adding a line in the middle', () => {
            assertValidChangeRange('line1\nline3', 'line1\nline2\nline3');
        });

        it('handles changing indentation', () => {
            assertValidChangeRange('  foo()', '    foo()');
        });

        it('handles windows-style line endings', () => {
            assertValidChangeRange('line1\r\nline2\r\nline3', 'line1\r\nmodified\r\nline3');
        });

        it('handles mixed line endings', () => {
            assertValidChangeRange('line1\nline2\r\nline3', 'line1\nchanged\r\nline3');
        });

        it('handles tabs vs spaces change', () => {
            assertValidChangeRange('\t\tfoo', '    foo');
        });

        it('handles trailing whitespace change', () => {
            assertValidChangeRange('foo   ', 'foo');
        });
    });

    describe('realistic code edits', () => {
        it('handles adding an import statement', () => {
            const old = `import { a } from 'module';\n\nconst x = a();`;
            const new_ = `import { a } from 'module';\nimport { b } from 'other';\n\nconst x = a();`;
            assertValidChangeRange(old, new_);
        });

        it('handles removing an import statement', () => {
            const old = `import { a } from 'module';\nimport { b } from 'other';\n\nconst x = a();`;
            const new_ = `import { a } from 'module';\n\nconst x = a();`;
            assertValidChangeRange(old, new_);
        });

        it('handles renaming a variable', () => {
            const old = `const foo = 1;\nconsole.log(foo);`;
            const new_ = `const bar = 1;\nconsole.log(bar);`;
            // Note: two separate changes, but computeChangeRange sees the overall diff
            assertValidChangeRange(old, new_);
        });

        it('handles changing a function signature', () => {
            const old = `function greet(name: string): void {\n  console.log(name);\n}`;
            const new_ = `function greet(name: string, age: number): void {\n  console.log(name, age);\n}`;
            assertValidChangeRange(old, new_);
        });

        it('handles adding a new function', () => {
            const old = `function a() {}\n`;
            const new_ = `function a() {}\n\nfunction b() {\n  return 42;\n}\n`;
            assertValidChangeRange(old, new_);
        });

        it('handles deleting a function', () => {
            const old = `function a() {}\n\nfunction b() {\n  return 42;\n}\n`;
            const new_ = `function a() {}\n`;
            assertValidChangeRange(old, new_);
        });

        it('handles changing a string literal', () => {
            assertValidChangeRange(`const msg = "hello world";`, `const msg = "goodbye world";`);
        });

        it('handles changing a template literal', () => {
            assertValidChangeRange(
                'const msg = `hello ${name}`;',
                'const msg = `hi ${name}, welcome!`;'
            );
        });

        it('handles wrapping code in a block', () => {
            const old = `const x = 1;\nconst y = 2;`;
            const new_ = `if (true) {\n  const x = 1;\n  const y = 2;\n}`;
            assertValidChangeRange(old, new_);
        });

        it('handles unwrapping code from a block', () => {
            const old = `if (true) {\n  const x = 1;\n  const y = 2;\n}`;
            const new_ = `const x = 1;\nconst y = 2;`;
            assertValidChangeRange(old, new_);
        });

        it('handles adding a property to an object', () => {
            const old = `const obj = {\n  a: 1,\n  b: 2\n};`;
            const new_ = `const obj = {\n  a: 1,\n  b: 2,\n  c: 3\n};`;
            assertValidChangeRange(old, new_);
        });

        it('handles commenting out a line', () => {
            const old = `const x = 1;\nconst y = 2;\nconst z = 3;`;
            const new_ = `const x = 1;\n// const y = 2;\nconst z = 3;`;
            assertValidChangeRange(old, new_);
        });

        it('handles typing one character at a time', () => {
            // Simulate typing 'const' character by character
            let text = '';
            for (const char of 'const x = 42;') {
                const newText = text + char;
                assertValidChangeRange(text, newText, `typing '${char}'`);
                text = newText;
            }
        });

        it('handles backspacing one character at a time', () => {
            let text = 'const x = 42;';
            while (text.length > 0) {
                const newText = text.slice(0, -1);
                assertValidChangeRange(text, newText, `backspace from '${text}'`);
                text = newText;
            }
        });
    });

    describe('realistic svelte/tsx generated code edits', () => {
        const sveltePrefix = '///<reference types="svelte" />\n;function $$render() {\n';
        const svelteSuffix =
            '\n;async () => {\n<></>};\nreturn { props: {}, slots: {}, events: {} }}\n';

        it('handles script-only change in generated svelte code', () => {
            const old = sveltePrefix + 'let count = 0;' + svelteSuffix;
            const new_ = sveltePrefix + 'let count = 10;' + svelteSuffix;
            const range = assertValidChangeRange(old, new_);
            // The change should be localized to the script region
            assert.ok(range.span.start >= sveltePrefix.length, 'Change should be after prefix');
            assert.ok(
                range.span.start + range.span.length <= old.length - svelteSuffix.length,
                'Change should be before suffix'
            );
        });

        it('handles adding an import in generated svelte code', () => {
            const old = sveltePrefix + 'let x = 1;' + svelteSuffix;
            const new_ =
                sveltePrefix + "import { onMount } from 'svelte';\nlet x = 1;" + svelteSuffix;
            assertValidChangeRange(old, new_);
        });

        it('handles template-only change in generated svelte code', () => {
            const script = 'let count = 0;';
            const old =
                sveltePrefix +
                script +
                '\n;async () => {\n<><div>{count}</div></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
            const new_ =
                sveltePrefix +
                script +
                '\n;async () => {\n<><p>{count}</p></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
            const range = assertValidChangeRange(old, new_);
            // The change should be localized to the template region (after the script)
            assert.ok(
                range.span.start >= sveltePrefix.length + script.length,
                'Change should be in template region'
            );
        });

        it('handles simultaneous script and template changes', () => {
            const old =
                sveltePrefix +
                'let count = 0;' +
                '\n;async () => {\n<><div>{count}</div></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
            const new_ =
                sveltePrefix +
                'let count = 0;\nlet name = "world";' +
                '\n;async () => {\n<><div>{count} {name}</div></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
            assertValidChangeRange(old, new_);
        });
    });

    describe('large texts', () => {
        it('handles large identical texts efficiently', () => {
            const text = 'x'.repeat(100_000);
            const range = computeChangeRange(text, text);
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 0);
        });

        it('handles single-char change in large text', () => {
            const old = 'a'.repeat(50_000) + 'X' + 'b'.repeat(50_000);
            const new_ = 'a'.repeat(50_000) + 'Y' + 'b'.repeat(50_000);
            const range = assertValidChangeRange(old, new_);
            assert.strictEqual(range.span.start, 50_000);
            assert.strictEqual(range.span.length, 1);
            assert.strictEqual(range.newLength, 1);
        });

        it('handles insertion at start of large text', () => {
            const base = 'x'.repeat(100_000);
            const range = assertValidChangeRange(base, 'PREFIX' + base);
            assert.strictEqual(range.span.start, 0);
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 6);
        });

        it('handles insertion at end of large text', () => {
            const base = 'x'.repeat(100_000);
            const range = assertValidChangeRange(base, base + 'SUFFIX');
            assert.strictEqual(range.span.start, 100_000);
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 6);
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

        it('handles large deletion in middle', () => {
            const prefix = 'a'.repeat(10_000);
            const middle = 'c'.repeat(50_000);
            const suffix = 'b'.repeat(10_000);
            const range = assertValidChangeRange(prefix + middle + suffix, prefix + suffix);
            assert.strictEqual(range.span.start, 10_000);
            assert.strictEqual(range.span.length, 50_000);
            assert.strictEqual(range.newLength, 0);
        });
    });

    describe('special characters and unicode', () => {
        it('handles unicode characters', () => {
            assertValidChangeRange('hello 世界', 'hello 世界!');
        });

        it('handles emoji', () => {
            assertValidChangeRange('hello 😀', 'hello 😀😀');
        });

        it('handles null bytes', () => {
            assertValidChangeRange('a\0b', 'a\0c');
        });

        it('handles special regex characters in content', () => {
            assertValidChangeRange('const re = /[a-z]+/g;', 'const re = /[a-z0-9]+/g;');
        });

        it('handles strings with quotes', () => {
            assertValidChangeRange(
                `const s = "it's a \\"test\\"";`,
                `const s = "it's a \\"new test\\"";`
            );
        });
    });

    describe('prefix/suffix overlap edge cases', () => {
        it('handles text where old is a prefix of new', () => {
            assertValidChangeRange('abc', 'abcdef');
        });

        it('handles text where new is a prefix of old', () => {
            assertValidChangeRange('abcdef', 'abc');
        });

        it('handles text where old is a suffix of new', () => {
            assertValidChangeRange('def', 'abcdef');
        });

        it('handles text where new is a suffix of old', () => {
            assertValidChangeRange('abcdef', 'def');
        });

        it('handles palindromic text with change in center', () => {
            assertValidChangeRange('abcba', 'abXba');
        });

        it('handles palindromic text with different lengths', () => {
            assertValidChangeRange('abcba', 'abXXXba');
        });

        it('handles text where change region itself has repeated chars', () => {
            // old: 'xxYYYxx' -> new: 'xxZZxx'
            // prefix: 'xx', suffix: 'xx', changed: 'YYY' -> 'ZZ'
            const range = assertValidChangeRange('xxYYYxx', 'xxZZxx');
            assert.strictEqual(range.span.start, 2);
            assert.strictEqual(range.span.length, 3);
            assert.strictEqual(range.newLength, 2);
        });

        it('handles single char old to longer new with same char', () => {
            // 'a' -> 'aaa': prefix='a', suffix could greedily match 'a'
            // but prefix constraint prevents suffix from going past prefix
            assertValidChangeRange('a', 'aaa');
        });

        it('handles longer old to single char new with same char', () => {
            assertValidChangeRange('aaa', 'a');
        });

        it('handles change at exact boundary of repeated sequences', () => {
            // 'aaabbb' -> 'aaaccc': prefix='aaa', suffix=''
            const range = assertValidChangeRange('aaabbb', 'aaaccc');
            assert.strictEqual(range.span.start, 3);
        });

        it('handles interleaved repeated patterns', () => {
            assertValidChangeRange('ababab', 'abababab');
        });

        it('handles change that turns one repeated char into another', () => {
            assertValidChangeRange('aaaaa', 'bbbbb');
        });

        it('handles very long common prefix with tiny change at end', () => {
            const common = 'x'.repeat(10000);
            const range = assertValidChangeRange(common + 'A', common + 'B');
            assert.strictEqual(range.span.start, 10000);
            assert.strictEqual(range.span.length, 1);
            assert.strictEqual(range.newLength, 1);
        });

        it('handles very long common suffix with tiny change at start', () => {
            const common = 'x'.repeat(10000);
            const range = assertValidChangeRange('A' + common, 'B' + common);
            assert.strictEqual(range.span.start, 0);
            assert.strictEqual(range.span.length, 1);
            assert.strictEqual(range.newLength, 1);
        });
    });

    describe('multiple changes collapsed into one range', () => {
        it('handles two separate changes producing a single spanning range', () => {
            // Two changes: 'X' at pos 3 and 'Y' at pos 7, seen as one big change
            const range = assertValidChangeRange('abcXdefYghi', 'abcAdefBghi');
            assert.strictEqual(range.span.start, 3);
            // The changed span covers from 'X' through 'Y' (positions 3-7 in old = length 5)
            assert.strictEqual(range.span.length, 5);
            assert.strictEqual(range.newLength, 5);
        });

        it('handles changes at both extremes', () => {
            // Change first and last char
            const range = assertValidChangeRange('XmiddleY', 'AmiddleB');
            assert.strictEqual(range.span.start, 0);
            assert.strictEqual(range.span.length, 8);
            assert.strictEqual(range.newLength, 8);
        });

        it('handles scattered changes in realistic code', () => {
            // Simulates renaming 'foo' to 'bar' in multiple places
            const old = 'const foo = 1;\nconsole.log(foo);\nreturn foo;';
            const new_ = 'const bar = 1;\nconsole.log(bar);\nreturn bar;';
            const range = assertValidChangeRange(old, new_);
            // Should span from first 'foo' to last 'foo'
            assert.strictEqual(range.span.start, 6); // 'const ' = 6
        });
    });

    describe('boundary conditions', () => {
        it('handles single character texts that differ', () => {
            const range = assertValidChangeRange('a', 'b');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 1 },
                newLength: 1
            });
        });

        it('handles two character texts with first char different', () => {
            const range = assertValidChangeRange('ab', 'xb');
            assert.deepStrictEqual(range, {
                span: { start: 0, length: 1 },
                newLength: 1
            });
        });

        it('handles two character texts with last char different', () => {
            const range = assertValidChangeRange('ab', 'ax');
            assert.deepStrictEqual(range, {
                span: { start: 1, length: 1 },
                newLength: 1
            });
        });

        it('handles growing from 1 char to 2 chars', () => {
            assertValidChangeRange('a', 'ab');
            assertValidChangeRange('a', 'ba');
        });

        it('handles shrinking from 2 chars to 1 char', () => {
            assertValidChangeRange('ab', 'a');
            assertValidChangeRange('ab', 'b');
        });

        it('handles newline-only texts', () => {
            assertValidChangeRange('\n', '\n\n');
            assertValidChangeRange('\n\n', '\n');
            assertValidChangeRange('\n\n\n', '\n\n\n\n');
        });

        it('handles text that is only whitespace', () => {
            assertValidChangeRange('   ', '    ');
            assertValidChangeRange('  \t', '  \t\t');
        });
    });

    describe('TS-realistic: svelte2tsx output patterns', () => {
        it('handles adding a reactive statement', () => {
            const base = [
                '///<reference types="svelte" />',
                ';function $$render() {',
                'let count = 0;',
                '',
                ';async () => {',
                '<><div>{count}</div></>};',
                'return { props: {}, slots: {}, events: {} }}',
                ''
            ].join('\n');
            const withReactive = [
                '///<reference types="svelte" />',
                ';function $$render() {',
                'let count = 0;',
                '$: doubled = count * 2;',
                '',
                ';async () => {',
                '<><div>{count} {doubled}</div></>};',
                'return { props: {}, slots: {}, events: {} }}',
                ''
            ].join('\n');
            const range = assertValidChangeRange(base, withReactive);
            // Change should start in the script region
            assert.ok(range.span.start > 0);
        });

        it('handles adding a store subscription ($: prefix)', () => {
            const old = [
                ';function $$render() {',
                "import { writable } from 'svelte/store';",
                'const count = writable(0);',
                ';async () => {',
                '<>{count}</>};',
                '}'
            ].join('\n');
            const new_ = [
                ';function $$render() {',
                "import { writable } from 'svelte/store';",
                'const count = writable(0);',
                'let $count = __sveltets_2_store_get(count);',
                ';async () => {',
                '<>{$count}</>};',
                '}'
            ].join('\n');
            assertValidChangeRange(old, new_);
        });

        it('handles changing only the component export at the end', () => {
            const prefix =
                '///<reference types="svelte" />\n;function $$render() {\nlet x = 1;\n;async () => {\n<></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
            const old =
                prefix +
                'export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent({}) {}';
            const new_ =
                prefix +
                'export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent({x: 1}) {}';
            const range = assertValidChangeRange(old, new_);
            // Change should be at the very end
            assert.ok(range.span.start > prefix.length);
        });

        it('handles adding an event handler in template', () => {
            const script = 'let count = 0;\nfunction increment() { count++; }';
            const templateOld = '<><button>{count}</button></>};';
            const templateNew = '<><button onclick={increment}>{count}</button></>};';
            const wrapper = (s: string, t: string) =>
                `///<reference types="svelte" />\n;function $$render() {\n${s}\n;async () => {\n${t}\nreturn { props: {}, slots: {}, events: {} }}\n`;
            assertValidChangeRange(wrapper(script, templateOld), wrapper(script, templateNew));
        });

        it('handles adding multiple imports at once', () => {
            const old = ';function $$render() {\nlet x = 1;\n};';
            const new_ =
                ";function $$render() {\nimport { onMount } from 'svelte';\nimport { fade } from 'svelte/transition';\nimport Component from './Component.svelte';\nlet x = 1;\n};";
            assertValidChangeRange(old, new_);
        });

        it('handles changing generic type parameters', () => {
            const old =
                ';function $$render<T>() {\nlet items: T[] = [];\n;async () => {\n<></>};\n}';
            const new_ =
                ';function $$render<T extends Record<string, unknown>>() {\nlet items: T[] = [];\n;async () => {\n<></>};\n}';
            assertValidChangeRange(old, new_);
        });
    });

    describe('symmetry and consistency', () => {
        it('change range is inverse-consistent for insert/delete pairs', () => {
            const small = 'abc';
            const big = 'abXYZc';
            const insertRange = computeChangeRange(small, big);
            const deleteRange = computeChangeRange(big, small);
            // Insertion: span at position 2, length 0, newLength 3
            // Deletion: span at position 2, length 3, newLength 0
            assert.strictEqual(insertRange.span.start, deleteRange.span.start);
            assert.strictEqual(insertRange.span.length, deleteRange.newLength);
            assert.strictEqual(insertRange.newLength, deleteRange.span.length);
        });

        it('produces tightest possible range (no unnecessary context)', () => {
            // For 'ABCDE' -> 'ABXDE': the tightest range is span(2,1) newLength=1
            // not span(0,5) newLength=5
            const range = computeChangeRange('ABCDE', 'ABXDE');
            assert.strictEqual(range.span.start, 2);
            assert.strictEqual(range.span.length, 1);
            assert.strictEqual(range.newLength, 1);
        });

        it('produces tightest range even with shared chars at change boundary', () => {
            // 'aXXa' -> 'aYYa': prefix='a', suffix='a', change='XX'->'YY'
            const range = computeChangeRange('aXXa', 'aYYa');
            assert.strictEqual(range.span.start, 1);
            assert.strictEqual(range.span.length, 2);
            assert.strictEqual(range.newLength, 2);
        });
    });

    describe('reconstruction invariant (batch)', () => {
        it('holds for many diverse edit patterns', () => {
            const cases: [string, string][] = [
                // Basic operations
                ['const x = 1;', 'const x = 42;'],
                ['function foo() {}', 'function fooBar() {}'],
                ['import { a } from "b"', 'import { a, c } from "b"'],
                ['line1\nline2\nline3', 'line1\nmodified\nline3'],
                ['abcdef', 'abcxyzdef'],
                ['abcxyzdef', 'abcdef'],
                // Edge cases
                ['', ''],
                ['', 'x'],
                ['x', ''],
                ['x', 'x'],
                ['a', 'b'],
                // Multiline
                ['a\nb\nc', 'a\nB\nc'],
                ['a\nb\nc', 'a\nc'],
                ['a\nc', 'a\nb\nc'],
                // Longer text
                ['the quick brown fox', 'the slow brown fox'],
                ['the quick brown fox', 'the quick red fox'],
                ['abcdefghij', 'abcXYZhij'],
                // Same length different content
                ['0123456789', '0123X56789'],
                // Prefix/suffix only
                ['prefix_middle_suffix', 'prefix_changed_suffix'],
                ['prefix_middle_suffix', 'prefix_suffix'],
                ['prefix_suffix', 'prefix_middle_suffix']
            ];

            for (const [oldText, newText] of cases) {
                assertValidChangeRange(oldText, newText, `'${oldText}' -> '${newText}'`);
            }
        });
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
            // old: '1;' -> new: '42;' but suffix ';' is shared
            // so old changed: '1' (length 1), new changed: '42' (length 2)
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

            // TS passes the same object reference since it was mutated in place
            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range, 'Should return a change range for self-reference after update');

            // Verify reconstruction
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

        it('handles multiple sequential in-place updates', () => {
            const snapshot = createSnapshot('let a = 1;\nlet b = 2;');

            // First update: change '1' to '10'
            snapshot.update([
                {
                    range: {
                        start: { line: 0, character: 8 },
                        end: { line: 0, character: 9 }
                    },
                    text: '10'
                }
            ]);
            const rangeAfterFirst = snapshot.getChangeRange(snapshot);
            assert.ok(rangeAfterFirst, 'Should have change range after first update');

            // Second update: change '2' to '20'
            const textBeforeSecond = snapshot.getFullText();
            snapshot.update([
                {
                    range: {
                        start: { line: 1, character: 8 },
                        end: { line: 1, character: 9 }
                    },
                    text: '20'
                }
            ]);
            const rangeAfterSecond = snapshot.getChangeRange(snapshot);
            assert.ok(rangeAfterSecond, 'Should have change range after second update');

            // Each update's range should reflect only that update
            assert.notDeepStrictEqual(rangeAfterFirst, rangeAfterSecond);

            // Verify the second range reconstructs correctly from pre-second-update text
            const newText = snapshot.getFullText();
            const before = textBeforeSecond.substring(0, rangeAfterSecond.span.start);
            const after = textBeforeSecond.substring(
                rangeAfterSecond.span.start + rangeAfterSecond.span.length
            );
            const inserted = newText.substring(
                rangeAfterSecond.span.start,
                rangeAfterSecond.span.start + rangeAfterSecond.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles full text replacement via update without range', () => {
            const snapshot = createSnapshot('const x = 1;');
            const oldText = snapshot.getFullText();
            snapshot.update([{ text: 'const y = 2;' }]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range, 'Should have change range after full replacement');

            // Verify reconstruction
            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles multiline in-place update', () => {
            const snapshot = createSnapshot('function foo() {\n  return 1;\n}');
            const oldText = snapshot.getFullText();

            snapshot.update([
                {
                    range: {
                        start: { line: 1, character: 9 },
                        end: { line: 1, character: 10 }
                    },
                    text: '"hello"'
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles inserting a new line via in-place update', () => {
            const snapshot = createSnapshot('line1\nline2');
            const oldText = snapshot.getFullText();

            snapshot.update([
                {
                    range: {
                        start: { line: 0, character: 5 },
                        end: { line: 0, character: 5 }
                    },
                    text: '\nnewline'
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles deleting a line via in-place update', () => {
            const snapshot = createSnapshot('line1\nline2\nline3');
            const oldText = snapshot.getFullText();

            snapshot.update([
                {
                    range: {
                        start: { line: 0, character: 5 },
                        end: { line: 1, character: 5 }
                    },
                    text: ''
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

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

        it('handles update that does not change the text', () => {
            const snapshot = createSnapshot('hello');
            snapshot.update([{ text: 'hello' }]);
            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);
            // No actual change, so span should be empty
            assert.strictEqual(range.span.length, 0);
            assert.strictEqual(range.newLength, 0);
        });

        it('handles multiple changes in a single update call', () => {
            const snapshot = createSnapshot('aaa\nbbb\nccc');
            const oldText = snapshot.getFullText();

            // Two changes: replace 'aaa' with 'AAA' and 'ccc' with 'CCC'
            // Note: changes are applied sequentially, so positions shift
            snapshot.update([
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 3 }
                    },
                    text: 'AAA'
                },
                {
                    range: {
                        start: { line: 2, character: 0 },
                        end: { line: 2, character: 3 }
                    },
                    text: 'CCC'
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles update that adds many lines', () => {
            const snapshot = createSnapshot('line1\nline2');
            const oldText = snapshot.getFullText();

            const manyLines = Array.from({ length: 100 }, (_, i) => `new_line_${i}`).join('\n');
            snapshot.update([
                {
                    range: {
                        start: { line: 1, character: 0 },
                        end: { line: 1, character: 5 }
                    },
                    text: manyLines
                }
            ]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

            const newText = snapshot.getFullText();
            const before = oldText.substring(0, range.span.start);
            const after = oldText.substring(range.span.start + range.span.length);
            const inserted = newText.substring(
                range.span.start,
                range.span.start + range.newLength
            );
            assert.strictEqual(before + inserted + after, newText);
        });

        it('handles update that removes all content', () => {
            const snapshot = createSnapshot('const x = 1;\nconst y = 2;\nconst z = 3;');
            const oldText = snapshot.getFullText();

            snapshot.update([{ text: '' }]);

            const range = snapshot.getChangeRange(snapshot);
            assert.ok(range);

            const newText = snapshot.getFullText();
            assert.strictEqual(newText, '');
            assert.strictEqual(range.span.start, 0);
            assert.strictEqual(range.span.length, oldText.length);
            assert.strictEqual(range.newLength, 0);
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

    it('handles different generated text with same structure', () => {
        const prefix = '///<reference types="svelte" />\n;function $$render() {\n';
        const suffix = '\n;async () => {\n<></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
        const old = createSvelteSnapshot(prefix + 'let count = 0;' + suffix);
        const current = createSvelteSnapshot(prefix + 'let count = 99;' + suffix);

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles completely different generated text', () => {
        const old = createSvelteSnapshot('let x = 1;');
        const current = createSvelteSnapshot('import { onMount } from "svelte";\nlet y = 2;');

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles empty old snapshot', () => {
        const old = createSvelteSnapshot('');
        const current = createSvelteSnapshot('let x = 1;');

        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.strictEqual(range.span.start, 0);
        assert.strictEqual(range.span.length, 0);
        assert.strictEqual(range.newLength, 10);
    });

    it('handles empty new snapshot', () => {
        const old = createSvelteSnapshot('let x = 1;');
        const current = createSvelteSnapshot('');

        const range = current.getChangeRange(old);
        assert.ok(range);
        assert.strictEqual(range.span.start, 0);
        assert.strictEqual(range.span.length, 10);
        assert.strictEqual(range.newLength, 0);
    });

    it('handles large generated text with small change', () => {
        const base = 'const x' + '= 1;\n'.repeat(1000);
        const old = createSvelteSnapshot(base + 'let final = 0;');
        const current = createSvelteSnapshot(base + 'let final = 999;');

        const range = current.getChangeRange(old);
        assert.ok(range);

        // Change should be near the end
        assert.ok(range.span.start >= base.length);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles generated text where original differs from generated', () => {
        // In real usage, the original svelte text differs from the generated TS text
        const originalSvelte = '<script>\n  let count = 0;\n</script>\n<p>{count}</p>';
        const oldGenerated =
            '///<reference types="svelte" />\n;function $$render() {\nlet count = 0;\n;async () => {\n<><p>{count}</p></>};\nreturn { props: {}, slots: {}, events: {} }}\n';
        const newGenerated =
            '///<reference types="svelte" />\n;function $$render() {\nlet count = 0;\nlet doubled = count * 2;\n;async () => {\n<><p>{count} {doubled}</p></>};\nreturn { props: {}, slots: {}, events: {} }}\n';

        const old = createSvelteSnapshot(oldGenerated, originalSvelte);
        const current = createSvelteSnapshot(newGenerated, originalSvelte);

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles cross-snapshot comparison with different original docs', () => {
        // Two completely different svelte files producing generated output
        const old = createSvelteSnapshot(
            ';function $$render() {\nlet x = 1;\n;async () => {\n<></>};\n}\n',
            '<script>let x = 1;</script>'
        );
        const current = createSvelteSnapshot(
            ';function $$render() {\nlet y = 2;\n;async () => {\n<></>};\n}\n',
            '<script>let y = 2;</script>'
        );

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles snapshot with prepended lines having different text', () => {
        // Test with nrPrependedLines > 0 (e.g. @ts-check comment)
        const uri = pathToUrl('/test/Component.svelte');
        const doc = new Document(uri, '<script>let x = 1;</script>');
        const old = new SvelteDocumentSnapshot(
            doc,
            null,
            ts.ScriptKind.TS,
            '4.0.0',
            '// @ts-check\n;function $$render() {\nlet x = 1;\n}',
            1, // nrPrependedLines
            { has: () => false }
        );
        const current = new SvelteDocumentSnapshot(
            doc,
            null,
            ts.ScriptKind.TS,
            '4.0.0',
            '// @ts-check\n;function $$render() {\nlet x = 42;\n}',
            1,
            { has: () => false }
        );

        const range = current.getChangeRange(old);
        assert.ok(range);

        const oldText = old.getFullText();
        const newText = current.getFullText();
        const before = oldText.substring(0, range.span.start);
        const after = oldText.substring(range.span.start + range.span.length);
        const inserted = newText.substring(range.span.start, range.span.start + range.newLength);
        assert.strictEqual(before + inserted + after, newText);
    });

    it('handles many sequential snapshots (simulating repeated edits)', () => {
        // Simulate a user editing a svelte file: each edit produces a new snapshot
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
