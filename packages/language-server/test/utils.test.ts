import {
    getCodeDescription,
    isBeforeOrEqualToPosition,
    makeLinksClickable,
    modifyLines,
    normalizePath,
    regexLastIndexOf
} from '../src/utils';
import { Position } from 'vscode-languageserver';
import * as assert from 'assert';
import { URI } from 'vscode-uri';

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
        it('should lowercase drive letters and normalize slashes', () => {
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

    describe('#makeLinksClickable', () => {
        it('should convert a simple URL to a markdown link', () => {
            assert.strictEqual(
                makeLinksClickable('See https://example.com for more info'),
                'See [https://example.com](https://example.com) for more info'
            );
        });

        it('should convert multiple URLs', () => {
            assert.strictEqual(
                makeLinksClickable('Check https://example.com and https://other.com'),
                'Check [https://example.com](https://example.com) and [https://other.com](https://other.com)'
            );
        });

        it('should handle URLs with paths', () => {
            assert.strictEqual(
                makeLinksClickable(
                    'See https://github.com/sveltejs/language-tools/tree/master/docs'
                ),
                'See [https://github.com/sveltejs/language-tools/tree/master/docs](https://github.com/sveltejs/language-tools/tree/master/docs)'
            );
        });

        it('should handle URLs with query strings and fragments', () => {
            assert.strictEqual(
                makeLinksClickable('See https://svelte.dev/docs?tab=api#section'),
                'See [https://svelte.dev/docs?tab=api#section](https://svelte.dev/docs?tab=api#section)'
            );
        });

        it('should not convert already-markdown URLs', () => {
            const alreadyMarkdown = 'See [example](https://example.com) for info';
            assert.strictEqual(makeLinksClickable(alreadyMarkdown), alreadyMarkdown);
        });

        it('should handle text without URLs', () => {
            const noUrl = 'This is just plain text without any URLs';
            assert.strictEqual(makeLinksClickable(noUrl), noUrl);
        });

        it('should handle http URLs', () => {
            assert.strictEqual(
                makeLinksClickable('Check http://example.com'),
                'Check [http://example.com](http://example.com)'
            );
        });

        it('should handle URLs at the end of a sentence', () => {
            assert.strictEqual(
                makeLinksClickable('For more info: https://svelte.dev/docs'),
                'For more info: [https://svelte.dev/docs](https://svelte.dev/docs)'
            );
        });
    });

    describe('#getCodeDescription', () => {
        it('should return codeDescription for a Svelte 5 underscore code', () => {
            assert.deepStrictEqual(getCodeDescription('export_let_unused'), {
                href: 'https://svelte.dev/docs/svelte/compiler-warnings#export_let_unused'
            });
        });

        it('should normalize Svelte 4 hyphen codes to underscores', () => {
            assert.deepStrictEqual(getCodeDescription('a11y-no-redundant-roles'), {
                href: 'https://svelte.dev/docs/svelte/compiler-warnings#a11y_no_redundant_roles'
            });
        });

        it('should handle codes with mixed hyphens and underscores', () => {
            assert.deepStrictEqual(getCodeDescription('css-unused-selector'), {
                href: 'https://svelte.dev/docs/svelte/compiler-warnings#css_unused_selector'
            });
        });

        it('should return undefined for numeric codes', () => {
            assert.strictEqual(getCodeDescription(123), undefined);
        });

        it('should return undefined for undefined', () => {
            assert.strictEqual(getCodeDescription(undefined), undefined);
        });

        it('should handle simple string codes', () => {
            assert.deepStrictEqual(getCodeDescription('warning'), {
                href: 'https://svelte.dev/docs/svelte/compiler-warnings#warning'
            });
        });
    });
});
