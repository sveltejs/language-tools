import {
    and,
    clamp,
    createGetCanonicalFileName,
    flatten,
    getIndent,
    getLastPartOfPath,
    getRegExpMatches,
    isBeforeOrEqualToPosition,
    isInRange,
    isNotNullOrUndefined,
    isPositionEqual,
    isRangeStartAfterEnd,
    isZeroLengthRange,
    memoize,
    modifyLines,
    moveRangeStartToEndIfNecessary,
    normalizePath,
    normalizeUri,
    not,
    or,
    passMap,
    pathToUrl,
    possiblyComponent,
    regexIndexOf,
    regexLastIndexOf,
    removeLineWithString,
    returnObjectIfHasKeys,
    swapRangeStartEndIfNecessary,
    toFileNameLowerCase,
    traverseTypeString,
    unique,
    urlToPath
} from '../src/utils';
import { Position, Range } from 'vscode-languageserver';
import * as assert from 'assert';

describe('utils', () => {
    describe('#not', () => {
        it('should negate predicate', () => {
            const isEven = (x: number) => x % 2 === 0;
            const isOdd = not(isEven);
            assert.equal(isOdd(3), true);
            assert.equal(isOdd(4), false);
        });
    });

    describe('#or', () => {
        it('should return true if any predicate matches', () => {
            const isZero = (x: number) => x === 0;
            const isPositive = (x: number) => x > 0;
            const isZeroOrPositive = or(isZero, isPositive);
            assert.equal(isZeroOrPositive(0), true);
            assert.equal(isZeroOrPositive(5), true);
            assert.equal(isZeroOrPositive(-1), false);
        });

        it('should return false if no predicates match', () => {
            const isFalse = or<boolean>(
                () => false,
                () => false
            );
            assert.equal(isFalse(true), false);
        });
    });

    describe('#and', () => {
        it('should return true if all predicates match', () => {
            const isPositive = (x: number) => x > 0;
            const isEven = (x: number) => x % 2 === 0;
            const isPositiveEven = and(isPositive, isEven);
            assert.equal(isPositiveEven(4), true);
            assert.equal(isPositiveEven(3), false);
            assert.equal(isPositiveEven(-2), false);
        });

        it('should return false if any predicate fails', () => {
            const isTrue = and<boolean>(
                () => true,
                () => false
            );
            assert.equal(isTrue(true), false);
        });
    });

    describe('#unique', () => {
        it('should remove duplicate primitives', () => {
            assert.deepStrictEqual(unique([1, 2, 2, 3, 1]), [1, 2, 3]);
        });

        it('should remove duplicate objects by deep equality', () => {
            const result = unique([{ a: 1 }, { a: 1 }, { a: 2 }]);
            assert.deepStrictEqual(result, [{ a: 1 }, { a: 2 }]);
        });

        it('should handle empty array', () => {
            assert.deepStrictEqual(unique([]), []);
        });
    });

    describe('#clamp', () => {
        it('should clamp value to minimum', () => {
            assert.equal(clamp(5, 10, 20), 10);
        });

        it('should clamp value to maximum', () => {
            assert.equal(clamp(25, 10, 20), 20);
        });

        it('should return value if within range', () => {
            assert.equal(clamp(15, 10, 20), 15);
        });

        it('should handle equal min and max', () => {
            assert.equal(clamp(15, 10, 10), 10);
        });
    });

    describe('#urlToPath', () => {
        it('should convert file URL to path', () => {
            const result = urlToPath('file:///Users/test/file.txt');
            assert.equal(result, '/Users/test/file.txt');
        });

        it('should return null for non-file URLs', () => {
            const result = urlToPath('http://example.com/file.txt');
            assert.equal(result, null);
        });

        it('should normalize backslashes', () => {
            const result = urlToPath('file:///C:/Users/test/file.txt');
            assert.equal(result?.includes('\\'), false);
        });
    });

    describe('#pathToUrl', () => {
        it('should convert path to file URL', () => {
            const result = pathToUrl('/Users/test/file.txt');
            assert.equal(result.startsWith('file://'), true);
        });
    });

    describe('#normalizePath', () => {
        it('should normalize path separators', () => {
            const result = normalizePath('/Users/test/file.txt');
            assert.equal(result?.includes('\\'), false);
        });
    });

    describe('#normalizeUri', () => {
        it('should normalize URI', () => {
            const result = normalizeUri('file:///Users/test/file.txt');
            assert.equal(result.startsWith('file://'), true);
        });
    });

    describe('#getLastPartOfPath', () => {
        it('should get last part with forward slash', () => {
            assert.equal(getLastPartOfPath('foo/bar/baz.txt'), 'baz.txt');
        });

        it('should get last part with backslash', () => {
            assert.equal(getLastPartOfPath('foo\\bar\\baz.txt'), 'baz.txt');
        });

        it('should get last part with mixed slashes', () => {
            assert.equal(getLastPartOfPath('foo/bar\\baz.txt'), 'baz.txt');
        });

        it('should return full string if no separators', () => {
            assert.equal(getLastPartOfPath('baz.txt'), 'baz.txt');
        });
    });

    describe('#flatten', () => {
        it('should flatten nested arrays', () => {
            assert.deepStrictEqual(flatten([1, [2, 3], 4, [5]]), [1, 2, 3, 4, 5]);
        });

        it('should handle empty arrays', () => {
            assert.deepStrictEqual(flatten([]), []);
        });

        it('should handle arrays with no nesting', () => {
            assert.deepStrictEqual(flatten([1, 2, 3]), [1, 2, 3]);
        });
    });

    describe('#passMap', () => {
        it('should map values when mapper returns array', () => {
            const result = passMap([1, 2, 3], (x) => (x === 2 ? [20, 21] : undefined));
            assert.deepStrictEqual(result, [1, [20, 21], 3]);
        });

        it('should keep original when mapper returns undefined', () => {
            const result = passMap([1, 2, 3], () => undefined);
            assert.deepStrictEqual(result, [1, 2, 3]);
        });
    });

    describe('#isInRange', () => {
        it('should return true for position in range', () => {
            const range = Range.create(0, 0, 2, 5);
            const pos = Position.create(1, 3);
            assert.equal(isInRange(range, pos), true);
        });

        it('should return false for position outside range', () => {
            const range = Range.create(0, 0, 2, 5);
            const pos = Position.create(3, 0);
            assert.equal(isInRange(range, pos), false);
        });

        it('should return true for position at range start', () => {
            const range = Range.create(0, 0, 2, 5);
            const pos = Position.create(0, 0);
            assert.equal(isInRange(range, pos), true);
        });

        it('should return true for position at range end', () => {
            const range = Range.create(0, 0, 2, 5);
            const pos = Position.create(2, 5);
            assert.equal(isInRange(range, pos), true);
        });
    });

    describe('#isZeroLengthRange', () => {
        it('should return true for zero-length range', () => {
            const range = Range.create(1, 5, 1, 5);
            assert.equal(isZeroLengthRange(range), true);
        });

        it('should return false for non-zero-length range', () => {
            const range = Range.create(1, 5, 1, 6);
            assert.equal(isZeroLengthRange(range), false);
        });
    });

    describe('#isRangeStartAfterEnd', () => {
        it('should return true when start line is after end line', () => {
            const range = Range.create(2, 0, 1, 0);
            assert.equal(isRangeStartAfterEnd(range), true);
        });

        it('should return true when start character is after end character on same line', () => {
            const range = Range.create(1, 5, 1, 3);
            assert.equal(isRangeStartAfterEnd(range), true);
        });

        it('should return false for valid range', () => {
            const range = Range.create(1, 0, 2, 0);
            assert.equal(isRangeStartAfterEnd(range), false);
        });

        it('should return false for zero-length range', () => {
            const range = Range.create(1, 5, 1, 5);
            assert.equal(isRangeStartAfterEnd(range), false);
        });
    });

    describe('#swapRangeStartEndIfNecessary', () => {
        it('should swap start and end when inverted', () => {
            const range = Range.create(2, 5, 1, 3);
            const result = swapRangeStartEndIfNecessary(range);
            assert.deepStrictEqual(result.start, Position.create(1, 3));
            assert.deepStrictEqual(result.end, Position.create(2, 5));
        });

        it('should not swap when range is valid', () => {
            const range = Range.create(1, 3, 2, 5);
            const result = swapRangeStartEndIfNecessary(range);
            assert.deepStrictEqual(result.start, Position.create(1, 3));
            assert.deepStrictEqual(result.end, Position.create(2, 5));
        });
    });

    describe('#moveRangeStartToEndIfNecessary', () => {
        it('should move start to end when inverted', () => {
            const range = Range.create(2, 5, 1, 3);
            const result = moveRangeStartToEndIfNecessary(range);
            assert.deepStrictEqual(result.start, Position.create(1, 3));
            assert.deepStrictEqual(result.end, Position.create(1, 3));
        });

        it('should not modify when range is valid', () => {
            const range = Range.create(1, 3, 2, 5);
            const result = moveRangeStartToEndIfNecessary(range);
            assert.deepStrictEqual(result.start, Position.create(1, 3));
            assert.deepStrictEqual(result.end, Position.create(2, 5));
        });
    });

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

        it('is after position (same line, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(1, 2));
            assert.equal(result, false);
        });
    });

    describe('#isPositionEqual', () => {
        it('should return true for equal positions', () => {
            const pos1 = Position.create(1, 5);
            const pos2 = Position.create(1, 5);
            assert.equal(isPositionEqual(pos1, pos2), true);
        });

        it('should return false for different lines', () => {
            const pos1 = Position.create(1, 5);
            const pos2 = Position.create(2, 5);
            assert.equal(isPositionEqual(pos1, pos2), false);
        });

        it('should return false for different characters', () => {
            const pos1 = Position.create(1, 5);
            const pos2 = Position.create(1, 6);
            assert.equal(isPositionEqual(pos1, pos2), false);
        });
    });

    describe('#isNotNullOrUndefined', () => {
        it('should return true for defined values', () => {
            assert.equal(isNotNullOrUndefined(0), true);
            assert.equal(isNotNullOrUndefined(''), true);
            assert.equal(isNotNullOrUndefined(false), true);
        });

        it('should return false for null', () => {
            assert.equal(isNotNullOrUndefined(null), false);
        });

        it('should return false for undefined', () => {
            assert.equal(isNotNullOrUndefined(undefined), false);
        });
    });

    describe('#regexIndexOf', () => {
        it('should find first match', () => {
            assert.equal(regexIndexOf('1 2 3', /\s/), 1);
        });

        it('should respect start position', () => {
            assert.equal(regexIndexOf('1 2 3', /\s/, 2), 1);
        });

        it('should return -1 when not found', () => {
            assert.equal(regexIndexOf('123', /\s/), -1);
        });

        it('should handle negative start position', () => {
            assert.equal(regexIndexOf('1 2 3', /\s/, -5), 1);
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

        it('should respect end position', () => {
            assert.equal(regexLastIndexOf('1 2 3', /\s/g, 2), 1);
        });

        it('should return -1 when not found', () => {
            assert.equal(regexLastIndexOf('123', /\s/g), -1);
        });

        it('should handle negative end position', () => {
            assert.equal(regexLastIndexOf('1 2 3', /\s/g, -1), -1);
        });
    });

    describe('#getRegExpMatches', () => {
        it('should get all matches', () => {
            const matches = getRegExpMatches(/\d+/g, '12 abc 34 def 56');
            assert.equal(matches.length, 3);
            assert.equal(matches[0][0], '12');
            assert.equal(matches[1][0], '34');
            assert.equal(matches[2][0], '56');
        });

        it('should return empty array when no matches', () => {
            const matches = getRegExpMatches(/\d+/g, 'abc def');
            assert.equal(matches.length, 0);
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

        it('should handle single line', () => {
            assert.equal(
                modifyLines('hello', (line) => line.toUpperCase()),
                'HELLO'
            );
        });

        it('should preserve empty lines', () => {
            assert.equal(
                modifyLines('a\n\nb', (line) => line + '1'),
                'a1\n1\nb1'
            );
        });
    });

    describe('#getIndent', () => {
        it('should get space indent', () => {
            assert.equal(getIndent('    code'), '    ');
        });

        it('should get tab indent', () => {
            assert.equal(getIndent('\t\tcode'), '\t\t');
        });

        it('should get mixed indent', () => {
            assert.equal(getIndent('  \t code'), '  \t ');
        });

        it('should return empty string for no indent', () => {
            assert.equal(getIndent('code'), '');
        });
    });

    describe('#possiblyComponent', () => {
        it('should return true for capitalized tag', () => {
            assert.equal(possiblyComponent('Component'), true);
        });

        it('should return false for lowercase tag', () => {
            assert.equal(possiblyComponent('div'), false);
        });

        it('should return false for lowercase starting tag', () => {
            assert.equal(possiblyComponent('myComponent'), false);
        });
    });

    describe('#returnObjectIfHasKeys', () => {
        it('should return object if has keys', () => {
            const obj = { a: 1 };
            assert.deepStrictEqual(returnObjectIfHasKeys(obj), obj);
        });

        it('should return undefined if empty object', () => {
            assert.equal(returnObjectIfHasKeys({}), undefined);
        });

        it('should return undefined if undefined', () => {
            assert.equal(returnObjectIfHasKeys(undefined), undefined);
        });
    });

    describe('#toFileNameLowerCase', () => {
        it('should convert to lowercase', () => {
            assert.equal(toFileNameLowerCase('FILE.TXT'), 'file.txt');
        });

        it('should handle paths', () => {
            const result = toFileNameLowerCase('/Path/To/FILE.TXT');
            assert.equal(result, '/path/to/file.txt');
        });

        it('should preserve already lowercase', () => {
            assert.equal(toFileNameLowerCase('file.txt'), 'file.txt');
        });
    });

    describe('#createGetCanonicalFileName', () => {
        it('should return identity function when case sensitive', () => {
            const fn = createGetCanonicalFileName(true);
            assert.equal(fn('FILE.txt'), 'FILE.txt');
        });

        it('should return lowercase function when case insensitive', () => {
            const fn = createGetCanonicalFileName(false);
            assert.equal(fn('FILE.TXT'), 'file.txt');
        });
    });

    describe('#memoize', () => {
        it('should memoize result', () => {
            let callCount = 0;
            const fn = memoize(() => {
                callCount++;
                return 42;
            });

            assert.equal(fn(), 42);
            assert.equal(fn(), 42);
            assert.equal(callCount, 1);
        });

        it('should handle different return values', () => {
            const fn = memoize(() => ({ value: 123 }));
            const result1 = fn();
            const result2 = fn();
            assert.equal(result1, result2); // Same object reference
        });
    });

    describe('#removeLineWithString', () => {
        it('should remove lines containing keyword', () => {
            const result = removeLineWithString('line1\nremove this\nline3', 'remove');
            assert.equal(result, 'line1\nline3');
        });

        it('should remove multiple lines', () => {
            const result = removeLineWithString('a\nremove\nb\nremove\nc', 'remove');
            assert.equal(result, 'a\nb\nc');
        });

        it('should handle no matches', () => {
            const result = removeLineWithString('line1\nline2', 'notfound');
            assert.equal(result, 'line1\nline2');
        });
    });

    describe('#traverseTypeString', () => {
        it('should find end character', () => {
            assert.equal(traverseTypeString('hello,world', 0, ','), 5);
        });

        it('should handle quotes', () => {
            // String: a,"b,c",d - comma at position 1 is outside, commas inside quotes should be ignored
            assert.equal(traverseTypeString('a,"b,c",d', 0, ','), 1);
        });

        it('should handle single quotes', () => {
            // String: a,'b,c',d - comma at position 1 is outside, commas inside quotes should be ignored
            assert.equal(traverseTypeString("a,'b,c',d", 0, ','), 1);
        });

        it('should skip commas inside double quotes', () => {
            // String: "x,y",z - first comma at position 2 is inside quotes, should find comma at position 5
            assert.equal(traverseTypeString('"x,y",z', 0, ','), 5);
        });

        it('should skip commas inside single quotes', () => {
            // String: 'x,y',z - first comma at position 2 is inside quotes, should find comma at position 5
            assert.equal(traverseTypeString("'x,y',z", 0, ','), 5);
        });

        it('should handle curly braces', () => {
            assert.equal(traverseTypeString('hello{a,b},end', 0, ','), 10);
        });

        it('should handle angle brackets', () => {
            assert.equal(traverseTypeString('Array<{a,b}>,end', 0, ','), 12);
        });

        it('should handle nested structures', () => {
            assert.equal(traverseTypeString('Map<string,Array<{a,b}>>,end', 0, ','), 24);
        });

        it('should return -1 when not found', () => {
            assert.equal(traverseTypeString('hello world', 0, ','), -1);
        });

        it('should respect start position', () => {
            assert.equal(traverseTypeString('a,b,c', 2, ','), 3);
        });

        it('should handle mixed quotes and brackets', () => {
            assert.equal(traverseTypeString('func<T>("test,value"),end', 0, ','), 21);
        });
    });
});
