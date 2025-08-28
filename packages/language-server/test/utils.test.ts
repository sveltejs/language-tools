import { isBeforeOrEqualToPosition, modifyLines, regexLastIndexOf } from '../src/utils';
import { Position } from 'vscode-languageserver';
import { describe, it, expect } from 'vitest';

describe('utils', () => {
    describe('#isBeforeOrEqualToPosition', () => {
        it('is before position (line, character lower)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(0, 0));
            expect(result).toBe(true);
        });

        it('is before position (line lower, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(0, 2));
            expect(result).toBe(true);
        });

        it('is equal to position', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(1, 1));
            expect(result).toBe(true);
        });

        it('is after position (line, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(2, 2));
            expect(result).toBe(false);
        });

        it('is after position (line lower, character higher)', () => {
            const result = isBeforeOrEqualToPosition(Position.create(1, 1), Position.create(2, 0));
            expect(result).toBe(false);
        });
    });

    describe('#regexLastIndexOf', () => {
        it('should work #1', () => {
            expect(regexLastIndexOf('1 2 3', /\s/g)).toBe(3);
        });

        it('should work #2', () => {
            expect(regexLastIndexOf('1_2:- 3', /\W/g)).toBe(5);
        });

        it('should work #3', () => {
            expect(regexLastIndexOf('<bla blubb={() => hello', /[\W\s]/g)).toBe(17);
        });
    });

    describe('#modifyLines', () => {
        it('should work', () => {
            expect(modifyLines('a\nb\r\nc\nd', (line) => 1 + line)).toBe('1a\n1b\r\n1c\n1d');
        });

        it('should pass correct line numbers', () => {
            const idxs: number[] = [];
            modifyLines('a\nb\r\nc\nd', (_, idx) => {
                idxs.push(idx);
                return _;
            });
            expect(idxs).toEqual([0, 1, 2, 3]);
        });
    });
});
