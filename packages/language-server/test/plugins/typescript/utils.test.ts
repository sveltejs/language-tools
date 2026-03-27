import { getTsCheckComment } from '../../../src/plugins/typescript/utils';
import ts from 'typescript';
import * as assert from 'assert';

describe('TypeScriptPlugin utils', () => {
    describe('#getTsCheckComment', () => {
        const tsCheckComment = `// @ts-check${ts.sys.newLine}`;
        const tsNocheckComment = `// @ts-nocheck${ts.sys.newLine}`;

        it('should not return if ts-check is after non-comment-code', () => {
            assert.deepStrictEqual(
                getTsCheckComment(`qwd
            // @ts-check`, ts.sys.newLine),
                undefined
            );
        });

        it('should return @ts-check', () => {
            assert.deepStrictEqual(
                getTsCheckComment(`
            // @ts-check`, ts.sys.newLine),
                tsCheckComment
            );
        });

        it('should return @ts-nocheck', () => {
            assert.deepStrictEqual(
                getTsCheckComment(`
            // @ts-nocheck`, ts.sys.newLine),
                tsNocheckComment
            );
        });

        it('should return if ts-check is after some comments', () => {
            assert.deepStrictEqual(
                getTsCheckComment(`
            // hello
            
            ///
            // @ts-check`, ts.sys.newLine),
                tsCheckComment
            );
        });

        it('should not return if there are comments but without ts-check', () => {
            assert.deepStrictEqual(
                getTsCheckComment(`
            // nope
            // almost@ts-check
            // @ts-almostcheck
            ///
            `, ts.sys.newLine),
                undefined
            );
        });
    });
});
