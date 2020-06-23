import { isBeforeOrEqualToPosition, regexLastIndexOf } from '../src/utils';
import { Position } from 'vscode-languageserver';
import * as assert from 'assert';

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
});
