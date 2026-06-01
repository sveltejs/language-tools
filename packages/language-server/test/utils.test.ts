import {
    isBeforeOrEqualToPosition,
    modifyLines,
    normalizePath,
    regexLastIndexOf,
    unique,
    groupBy,
    debounce
} from '../src/utils';
import { Position } from 'vscode-languageserver';
import * as assert from 'assert';
import sinon from 'sinon';

describe('utils', () => {
    describe('#isBeforeOrEqualToPosition', () => {
        it('is before position (line, character lower)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(0, 0));
            assert.equal(result, true);
        });

        it('is before position (line lower, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(0, 2));
            assert.equal(result, true);
        });

        it('is equal to position', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(1, 1));
            assert.equal(result, true);
        });

        it('is after position (line, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(2, 2));
            assert.equal(result, false);
        });

        it('is after position (line lower, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(2, 0));
            assert.equal(result, false);
        });
    });

    describe('#regexLastIndexOf', () => {
        it('should work #1', () => {
            assert.equal(regexLastIndexOf('1 2 3', /\s/g), 3);
        });

        it('should work #2', () => {
            assert.equal(regexLastIndexOf('1_2:- 3', /\W/g), 5);
        });

        it('should work #3', () => {
            assert.equal(regexLastIndexOf('<bla blubb={() => hello', /[\W\s]/g), 17);
        });
    });

    describe('#modifyLines', () => {
        it('should work', () => {
            assert.equal(
                modifyLines('a\nb\r\nc\nd', (line) => 1 + line),
                '1a\n1b\r\n1c\n1d'
            );
        });

        it('should pass correct line numbers', () => {
            const idxs: number[] = [];
            modifyLines('a\nb\r\nc\nd', (_, idx) => {
                idxs.push(idx);
                return _;
            });
            assert.deepStrictEqual(idxs, [0, 1, 2, 3]);
        });
    });

    describe('path normalization on Windows', () => {
        it('should lowercase drive letters and normalize slashes on Windows', () => {
            assert.strictEqual(
                normalizePath('C:\\Users\\Test\\project\\file.ts'),
                'c:/Users/Test/project/file.ts'
            );

            assert.strictEqual(
                normalizePath('D:/Some/Other/Path/file.ts'),
                'd:/Some/Other/Path/file.ts'
            );

            assert.strictEqual(
                normalizePath('e:\\Mixed/Slashes\\Path/file.ts'),
                'e:/Mixed/Slashes/Path/file.ts'
            );

            assert.strictEqual(
                normalizePath('/already/normalized/path/file.ts'),
                '/already/normalized/path/file.ts'
            );
        });
    });

    describe('#unique', () => {
        it('removes duplicate primitives', () => {
            assert.deepStrictEqual(unique([1, 2, 1, 3, 2]), [1, 2, 3]);
            assert.deepStrictEqual(unique(['a', 'b', 'a']), ['a', 'b']);
        });

        it('removes deeply equal objects', () => {
            assert.deepStrictEqual(unique([{ a: 1 }, { b: 2 }, { a: 1 }]), [{ a: 1 }, { b: 2 }]);
        });

        it('removes deeply equal nested objects', () => {
            assert.deepStrictEqual(unique([{ x: { y: 1 } }, { x: { y: 2 } }, { x: { y: 1 } }]), [
                { x: { y: 1 } },
                { x: { y: 2 } }
            ]);
        });

        it('keeps all items when none are equal', () => {
            const input = [{ a: 1 }, { a: 2 }, { a: 3 }];
            assert.strictEqual(unique(input).length, 3);
        });

        it('returns empty array for empty input', () => {
            assert.deepStrictEqual(unique([]), []);
        });
    });

    describe('#groupBy', () => {
        it('produces one key per unique value returned by predicate', () => {
            const result = groupBy(['apple', 'banana', 'avocado'], (s) => s[0]);
            assert.ok('a' in result);
            assert.ok('b' in result);
            assert.strictEqual(Object.keys(result).length, 2);
        });

        it('keeps the first occurrence when multiple items share a key', () => {
            const items = [
                { file: 'a.ts', msg: 'first' },
                { file: 'a.ts', msg: 'second' },
                { file: 'b.ts', msg: 'only' }
            ];
            const result = groupBy(items, (i) => i.file);
            assert.strictEqual(Object.keys(result).length, 2);
            assert.strictEqual(result['a.ts'].msg, 'first');
            assert.strictEqual(result['b.ts'].msg, 'only');
        });

        it('returns an empty object for an empty array', () => {
            assert.deepStrictEqual(
                groupBy([], () => 'key'),
                {}
            );
        });
    });

    describe('#debounce', () => {
        it('only calls the function after the delay has elapsed', () => {
            const clock = sinon.useFakeTimers();
            try {
                let callCount = 0;
                const fn = debounce(() => callCount++, 100);

                fn();
                assert.strictEqual(callCount, 0, 'should not fire immediately');

                clock.tick(99);
                assert.strictEqual(callCount, 0, 'should not fire before delay');

                clock.tick(1);
                assert.strictEqual(callCount, 1, 'should fire after delay');
            } finally {
                clock.restore();
            }
        });

        it('resets the timer when called again before the delay elapses', () => {
            const clock = sinon.useFakeTimers();
            try {
                let callCount = 0;
                const fn = debounce(() => callCount++, 100);

                fn();
                clock.tick(50);
                fn(); // reset
                clock.tick(50); // 50ms after second call — should not have fired yet
                assert.strictEqual(callCount, 0, 'should not fire before reset delay');

                clock.tick(50); // now 100ms after second call
                assert.strictEqual(callCount, 1, 'should fire once after reset delay');
            } finally {
                clock.restore();
            }
        });

        it('fires exactly once even when called many times in quick succession', () => {
            const clock = sinon.useFakeTimers();
            try {
                let callCount = 0;
                const fn = debounce(() => callCount++, 100);

                fn();
                fn();
                fn();
                clock.tick(100);
                assert.strictEqual(callCount, 1);
            } finally {
                clock.restore();
            }
        });
    });
});
