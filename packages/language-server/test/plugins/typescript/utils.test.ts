import { getTsCheckComment } from '../../../src/plugins/typescript/utils';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

describe('TypeScriptPlugin utils', () => {
    describe('#getTsCheckComment', () => {
        const tsCheckComment = `// @ts-check${ts.sys.newLine}`;
        const tsNocheckComment = `// @ts-nocheck${ts.sys.newLine}`;

        it('should not return if ts-check is after non-comment-code', () => {
            expect(
                getTsCheckComment(`qwd
            // @ts-check`),
                undefined
            );
        });

        it('should return @ts-check', () => {
            expect(
                getTsCheckComment(`
            // @ts-check`),
                tsCheckComment
            );
        });

        it('should return @ts-nocheck', () => {
            expect(
                getTsCheckComment(`
            // @ts-nocheck`),
                tsNocheckComment
            );
        });

        it('should return if ts-check is after some comments', () => {
            expect(
                getTsCheckComment(`
            // hello
            
            ///
            // @ts-check`),
                tsCheckComment
            );
        });

        it('should not return if there are comments but without ts-check', () => {
            expect(
                getTsCheckComment(`
            // nope
            // almost@ts-check
            // @ts-almostcheck
            ///
            `),
                undefined
            );
        });
    });
});
