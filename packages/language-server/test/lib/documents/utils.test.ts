import * as assert from 'assert';
import {
    getLineAtPosition,
    extractStyleTag,
    extractScriptTags,
    extractTemplateTag,
    updateRelativeImport,
    getWordAt,
    getWordRangeAt,
    positionAt,
    offsetAt,
    getLineOffsets,
    isInTag,
    isRangeInTag,
    getTextInRange,
    isAtEndOfLine,
    toRange,
    getLangAttribute,
    isInsideMoustacheTag
} from '../../../src/lib/documents/utils';
import { Position, Range } from 'vscode-languageserver';

describe('document/utils', () => {
    describe('extractTag', () => {
        it('supports boolean attributes', () => {
            const extracted = extractStyleTag('<style test></style>');
            assert.deepStrictEqual(extracted?.attributes, { test: 'test' });
        });

        it('supports unquoted attributes', () => {
            const extracted = extractStyleTag('<style type=text/css></style>');
            assert.deepStrictEqual(extracted?.attributes, {
                type: 'text/css'
            });
        });

        it('does not extract style tag inside comment', () => {
            const text = `
                <p>bla</p>
                <!--<style>h1{ color: blue; }</style>-->
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 108,
                end: 125,
                startPos: Position.create(3, 23),
                endPos: Position.create(3, 40),
                container: { start: 101, end: 133 }
            });
        });

        it('does not extract tags starting with style/script', () => {
            // https://github.com/sveltejs/language-tools/issues/43
            // this would previously match <styles>....</style> due to misconfigured attribute matching regex
            const text = `
            <styles>p{ color: blue; }</styles>
            <p>bla</p>
            ></style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), null);
        });

        it('is case sensitive to style/script', () => {
            const text = `
            <Style></Style>
            <Script></Script>
            `;
            assert.deepStrictEqual(extractStyleTag(text), null);
            assert.deepStrictEqual(extractScriptTags(text), null);
        });

        it('only extract attribute until tag ends', () => {
            const text = `
            <script type="typescript">
            () => abc
            </script>
            `;
            const extracted = extractScriptTags(text);
            const attributes = extracted?.script?.attributes;
            assert.deepStrictEqual(attributes, { type: 'typescript' });
        });

        it('can extract with self-closing component before it', () => {
            const extracted = extractStyleTag('<SelfClosing /><style></style>');
            assert.deepStrictEqual(extracted, {
                start: 22,
                end: 22,
                startPos: {
                    character: 22,
                    line: 0
                },
                endPos: {
                    character: 22,
                    line: 0
                },
                attributes: {},
                content: '',
                container: {
                    end: 30,
                    start: 15
                }
            });
        });

        it('can extract with unclosed component after it', () => {
            const extracted = extractStyleTag('<style></style><C {#if asd}<p>asd</p>{/if}');
            assert.deepStrictEqual(extracted, {
                start: 7,
                end: 7,
                startPos: {
                    character: 7,
                    line: 0
                },
                endPos: {
                    character: 7,
                    line: 0
                },
                attributes: {},
                content: '',
                container: {
                    start: 0,
                    end: 15
                }
            });
        });

        it('extracts style tag', () => {
            const text = `
                <p>bla</p>
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 51,
                end: 68,
                startPos: Position.create(2, 23),
                endPos: Position.create(2, 40),
                container: { start: 44, end: 76 }
            });
        });

        it('extracts style tag with attributes', () => {
            const text = `
                <style lang="scss">p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: { lang: 'scss' },
                start: 36,
                end: 53,
                startPos: Position.create(1, 35),
                endPos: Position.create(1, 52),
                container: { start: 17, end: 61 }
            });
        });

        it('extracts style tag with attributes and extra whitespace', () => {
            const text = `
                <style     lang="scss"    >  p{ color: blue; }  </style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: '  p{ color: blue; }  ',
                attributes: { lang: 'scss' },
                start: 44,
                end: 65,
                startPos: Position.create(1, 43),
                endPos: Position.create(1, 64),
                container: { start: 17, end: 73 }
            });
        });

        it('extracts script tag with attribute with > in it', () => {
            const text = `
                <script lang="ts" generics="T extends Record<string, any>">content</script>
                <p>bla</p>
            `;
            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'content',
                attributes: {
                    generics: 'T extends Record<string, any>',
                    lang: 'ts'
                },
                start: 76,
                end: 83,
                startPos: Position.create(1, 75),
                endPos: Position.create(1, 82),
                container: { start: 17, end: 92 }
            });
        });

        it('extracts top level script tag only', () => {
            const text = `
                {#if name}
                    <script>
                        console.log('if not top level')
                    </script>
                {/if}
                <ul>
                    {#each cats as cat}
                        <script>
                            console.log('each not top level')
                        </script>
                    {/each}
                </ul>
                {#await promise}
                    <script>
                        console.log('await not top level')
                    </script>
                {:then number}
                    <script>
                        console.log('then not top level')
                    </script>
                {:catch error}
                    <script>
                        console.log('catch not top level')
                    </script>
                {/await}
                <p>{@html <script> console.log('html not top level')</script>}</p>
                {@html mycontent}
                {@debug myvar}
                <!-- p{ color: blue; }</script> -->
                <!--<script lang="scss">
                p{ color: blue; }
                </script> -->
                <scrit>blah</scrit>
                <script>top level script</script>
            `;

            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'top level script',
                attributes: {},
                start: 1243,
                end: 1259,
                startPos: Position.create(34, 24),
                endPos: Position.create(34, 40),
                container: { start: 1235, end: 1268 }
            });
        });

        it("extracts top level script when there're whitespace before block name", () => {
            const text = `
                <script>top level script</script>
                {  #if myvar } {/if}
            `;

            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'top level script',
                attributes: {},
                start: 25,
                end: 41,
                startPos: Position.create(1, 24),
                endPos: Position.create(1, 40),
                container: { start: 17, end: 50 }
            });
        });

        it('ignores script tag in svelte:head', () => {
            // https://github.com/sveltejs/language-tools/issues/143#issuecomment-636422045
            const text = `
            <svelte:head>
                <link rel="stylesheet" href="/lib/jodit.es2018.min.css" />
                <script src="/lib/jodit.es2018.min.js"> 
                </script>
            </svelte:head>
            <p>jo</p>
            <script>top level script</script>
            <h1>Hello, world!</h1>
            <style>.bla {}</style>
            `;
            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'top level script',
                attributes: {},
                start: 254,
                end: 270,
                startPos: Position.create(7, 20),
                endPos: Position.create(7, 36),
                container: { start: 246, end: 279 }
            });
        });

        it('extracts script and module script', () => {
            const text = `
            <script context="module">a</script>
            <script>b</script>
            `;
            assert.deepStrictEqual(extractScriptTags(text), {
                moduleScript: {
                    attributes: {
                        context: 'module'
                    },
                    container: {
                        end: 48,
                        start: 13
                    },
                    content: 'a',
                    start: 38,
                    end: 39,
                    startPos: {
                        character: 37,
                        line: 1
                    },
                    endPos: {
                        character: 38,
                        line: 1
                    }
                },
                script: {
                    attributes: {},
                    container: {
                        end: 79,
                        start: 61
                    },
                    content: 'b',
                    start: 69,
                    end: 70,
                    startPos: {
                        character: 20,
                        line: 2
                    },
                    endPos: {
                        character: 21,
                        line: 2
                    }
                }
            });
        });

        it('extract tag correctly with #if and < operator', () => {
            const text = `
            {#if value < 3}
              <div>
                bla
              </div>
            {:else if value < 4}
            {/if}
          <script>let value = 2</script>

          <div>
            {#if value < 3}
              <div>
                bla
              </div>
            {:else if value < 4}
            {/if}
          </div>`;
            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'let value = 2',
                attributes: {},
                start: 159,
                end: 172,
                startPos: Position.create(7, 18),
                endPos: Position.create(7, 31),
                container: { start: 151, end: 181 }
            });
        });

        it('extract tag correctly if nothing is before the tag', () => {
            const text = `<script>let value = 2</script>
                {/if}`;
            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'let value = 2',
                attributes: {},
                start: 8,
                end: 21,
                startPos: Position.create(0, 8),
                endPos: Position.create(0, 21),
                container: { start: 0, end: 30 }
            });
        });
    });

    describe('#getLineAtPosition', () => {
        it('should return line at position (only one line)', () => {
            assert.deepStrictEqual(getLineAtPosition(Position.create(0, 1), 'ABC'), 'ABC');
        });

        it('should return line at position (multiple lines)', () => {
            assert.deepStrictEqual(
                getLineAtPosition(Position.create(1, 1), 'ABC\nDEF\nGHI'),
                'DEF\n'
            );
        });
    });

    describe('#updateRelativeImport', () => {
        it('should update path of component with ending', () => {
            const newPath = updateRelativeImport(
                'C:/absolute/path/oldPath',
                'C:/absolute/newPath',
                './Component.svelte'
            );
            assert.deepStrictEqual(newPath, '../path/oldPath/Component.svelte');
        });

        it('should update path of file without ending', () => {
            const newPath = updateRelativeImport(
                'C:/absolute/path/oldPath',
                'C:/absolute/newPath',
                './someTsFile'
            );
            assert.deepStrictEqual(newPath, '../path/oldPath/someTsFile');
        });

        it('should update path of file going one up', () => {
            const newPath = updateRelativeImport(
                'C:/absolute/path/oldPath',
                'C:/absolute/path',
                './someTsFile'
            );
            assert.deepStrictEqual(newPath, './oldPath/someTsFile');
        });
    });

    describe('#getWordAt', () => {
        it('returns word between whitespaces', () => {
            assert.equal(getWordAt('qwd asd qwd', 5), 'asd');
        });

        it('returns word between whitespace and end of string', () => {
            assert.equal(getWordAt('qwd asd', 5), 'asd');
        });

        it('returns word between start of string and whitespace', () => {
            assert.equal(getWordAt('asd qwd', 2), 'asd');
        });

        it('returns word between start of string and end of string', () => {
            assert.equal(getWordAt('asd', 2), 'asd');
        });

        it('returns word with custom delimiters', () => {
            assert.equal(
                getWordAt('asd on:asd-qwd="asd" ', 10, { left: /\S+$/, right: /[\s=]/ }),
                'on:asd-qwd'
            );
        });

        function testEvent(str: string, pos: number, expected: string) {
            assert.equal(getWordAt(str, pos, { left: /\S+$/, right: /[^\w$:]/ }), expected);
        }

        it('returns event #1', () => {
            testEvent('<div on:>', 8, 'on:');
        });

        it('returns event #2', () => {
            testEvent('<div on: >', 8, 'on:');
        });

        it('returns empty string when only whitespace', () => {
            assert.equal(getWordAt('a  a', 2), '');
        });
    });

    describe('#getWordRangeAt', () => {
        it('returns range between whitespaces', () => {
            assert.deepStrictEqual(getWordRangeAt('qwd asd qwd', 5), { start: 4, end: 7 });
        });

        it('returns range between whitespace and end of string', () => {
            assert.deepStrictEqual(getWordRangeAt('qwd asd', 5), { start: 4, end: 7 });
        });

        it('returns range between start of string and whitespace', () => {
            assert.deepStrictEqual(getWordRangeAt('asd qwd', 2), { start: 0, end: 3 });
        });

        it('returns range for entire string when no delimiters', () => {
            assert.deepStrictEqual(getWordRangeAt('asd', 2), { start: 0, end: 3 });
        });

        it('returns range with custom delimiters', () => {
            assert.deepStrictEqual(
                getWordRangeAt('asd on:asd-qwd="asd" ', 10, { left: /\S+$/, right: /[\s=]/ }),
                { start: 4, end: 14 }
            );
        });
    });

    describe('#extractTemplateTag', () => {
        it('should extract template tag', () => {
            const text = '<template>content</template>';
            const extracted = extractTemplateTag(text);
            assert.deepStrictEqual(extracted?.content, 'content');
        });

        it('should return null when no template tag', () => {
            const text = '<div>no template</div>';
            assert.equal(extractTemplateTag(text), null);
        });

        it('should extract first template tag only', () => {
            const text = '<template>first</template><template>second</template>';
            const extracted = extractTemplateTag(text);
            assert.equal(extracted?.content, 'first');
        });
    });

    describe('#positionAt', () => {
        it('should return position at offset (single line)', () => {
            const pos = positionAt(3, 'abcdef');
            assert.deepStrictEqual(pos, Position.create(0, 3));
        });

        it('should return position at offset (multiple lines)', () => {
            const pos = positionAt(7, 'abc\ndefghi');
            assert.deepStrictEqual(pos, Position.create(1, 3));
        });

        it('should handle CRLF line breaks', () => {
            const pos = positionAt(8, 'abc\r\ndefghi');
            assert.deepStrictEqual(pos, Position.create(1, 3));
        });

        it('should clamp offset to text length', () => {
            const pos = positionAt(100, 'short');
            assert.deepStrictEqual(pos, Position.create(0, 5));
        });

        it('should handle negative offset', () => {
            const pos = positionAt(-5, 'text');
            assert.deepStrictEqual(pos, Position.create(0, 0));
        });

        it('should handle empty text', () => {
            const pos = positionAt(0, '');
            assert.deepStrictEqual(pos, Position.create(0, 0));
        });

        it('should return position at start of second line', () => {
            const pos = positionAt(4, 'abc\ndef');
            assert.deepStrictEqual(pos, Position.create(1, 0));
        });
    });

    describe('#offsetAt', () => {
        it('should return offset at position (single line)', () => {
            const offset = offsetAt(Position.create(0, 3), 'abcdef');
            assert.equal(offset, 3);
        });

        it('should return offset at position (multiple lines)', () => {
            const offset = offsetAt(Position.create(1, 3), 'abc\ndefghi');
            assert.equal(offset, 7);
        });

        it('should handle CRLF line breaks', () => {
            const offset = offsetAt(Position.create(1, 3), 'abc\r\ndefghi');
            assert.equal(offset, 8);
        });

        it('should clamp to text length when line exceeds', () => {
            const offset = offsetAt(Position.create(10, 0), 'abc');
            assert.equal(offset, 3);
        });

        it('should return 0 for negative line', () => {
            const offset = offsetAt(Position.create(-1, 5), 'abc\ndef');
            assert.equal(offset, 0);
        });

        it('should clamp character to line length', () => {
            const offset = offsetAt(Position.create(0, 100), 'abc\ndef');
            assert.equal(offset, 4);
        });
    });

    describe('#getLineOffsets', () => {
        it('should return offsets for single line', () => {
            const offsets = getLineOffsets('hello');
            assert.deepStrictEqual(offsets, [0]);
        });

        it('should return offsets for multiple lines with LF', () => {
            const offsets = getLineOffsets('a\nb\nc');
            assert.deepStrictEqual(offsets, [0, 2, 4]);
        });

        it('should return offsets for multiple lines with CRLF', () => {
            const offsets = getLineOffsets('a\r\nb\r\nc');
            assert.deepStrictEqual(offsets, [0, 3, 6]);
        });

        it('should handle mixed line breaks', () => {
            const offsets = getLineOffsets('a\nb\r\nc');
            assert.deepStrictEqual(offsets, [0, 2, 5]);
        });

        it('should handle empty string', () => {
            const offsets = getLineOffsets('');
            assert.deepStrictEqual(offsets, []);
        });

        it('should handle trailing newline', () => {
            const offsets = getLineOffsets('a\nb\n');
            assert.deepStrictEqual(offsets, [0, 2, 4]);
        });
    });

    describe('#isInTag', () => {
        it('should return true when position is in tag', () => {
            const tagInfo = {
                content: 'test',
                attributes: {},
                start: 10,
                end: 20,
                startPos: Position.create(0, 10),
                endPos: Position.create(0, 20),
                container: { start: 5, end: 25 }
            };
            assert.equal(isInTag(Position.create(0, 15), tagInfo), true);
        });

        it('should return false when position is outside tag', () => {
            const tagInfo = {
                content: 'test',
                attributes: {},
                start: 10,
                end: 20,
                startPos: Position.create(0, 10),
                endPos: Position.create(0, 20),
                container: { start: 5, end: 25 }
            };
            assert.equal(isInTag(Position.create(0, 25), tagInfo), false);
        });

        it('should return false when tagInfo is null', () => {
            assert.equal(isInTag(Position.create(0, 10), null), false);
        });

        it('should return true for position at start', () => {
            const tagInfo = {
                content: 'test',
                attributes: {},
                start: 10,
                end: 20,
                startPos: Position.create(0, 10),
                endPos: Position.create(0, 20),
                container: { start: 5, end: 25 }
            };
            assert.equal(isInTag(Position.create(0, 10), tagInfo), true);
        });

        it('should return true for position at end', () => {
            const tagInfo = {
                content: 'test',
                attributes: {},
                start: 10,
                end: 20,
                startPos: Position.create(0, 10),
                endPos: Position.create(0, 20),
                container: { start: 5, end: 25 }
            };
            assert.equal(isInTag(Position.create(0, 20), tagInfo), true);
        });
    });

    describe('#isRangeInTag', () => {
        const tagInfo = {
            content: 'test',
            attributes: {},
            start: 10,
            end: 20,
            startPos: Position.create(0, 10),
            endPos: Position.create(0, 20),
            container: { start: 5, end: 25 }
        };

        it('should return true when range is fully in tag', () => {
            const range = Range.create(Position.create(0, 12), Position.create(0, 18));
            assert.equal(isRangeInTag(range, tagInfo), true);
        });

        it('should return false when range start is outside', () => {
            const range = Range.create(Position.create(0, 5), Position.create(0, 15));
            assert.equal(isRangeInTag(range, tagInfo), false);
        });

        it('should return false when range end is outside', () => {
            const range = Range.create(Position.create(0, 15), Position.create(0, 25));
            assert.equal(isRangeInTag(range, tagInfo), false);
        });

        it('should return false when tagInfo is null', () => {
            const range = Range.create(Position.create(0, 12), Position.create(0, 18));
            assert.equal(isRangeInTag(range, null), false);
        });
    });

    describe('#getTextInRange', () => {
        it('should extract text in range (single line)', () => {
            const text = 'hello world';
            const range = Range.create(Position.create(0, 0), Position.create(0, 5));
            assert.equal(getTextInRange(range, text), 'hello');
        });

        it('should extract text in range (multiple lines)', () => {
            const text = 'line1\nline2\nline3';
            const range = Range.create(Position.create(0, 0), Position.create(1, 5));
            assert.equal(getTextInRange(range, text), 'line1\nline2');
        });

        it('should extract partial text from line', () => {
            const text = 'hello world';
            const range = Range.create(Position.create(0, 6), Position.create(0, 11));
            assert.equal(getTextInRange(range, text), 'world');
        });

        it('should handle empty range', () => {
            const text = 'hello';
            const range = Range.create(Position.create(0, 2), Position.create(0, 2));
            assert.equal(getTextInRange(range, text), '');
        });
    });

    describe('#isAtEndOfLine', () => {
        it('should return true at LF', () => {
            assert.equal(isAtEndOfLine('hello\n', 5), true);
        });

        it('should return true at CR', () => {
            assert.equal(isAtEndOfLine('hello\r', 5), true);
        });

        it('should return true at end of string', () => {
            assert.equal(isAtEndOfLine('hello', 5), true);
        });

        it('should return false in middle of line', () => {
            assert.equal(isAtEndOfLine('hello world', 5), false);
        });

        it('should return true at CRLF (CR position)', () => {
            assert.equal(isAtEndOfLine('hello\r\n', 5), true);
        });
    });

    describe('#toRange', () => {
        it('should convert offsets to range', () => {
            const text = 'hello\nworld';
            const range = toRange(text, 0, 5);
            assert.deepStrictEqual(
                range,
                Range.create(Position.create(0, 0), Position.create(0, 5))
            );
        });

        it('should handle multi-line range', () => {
            const text = 'hello\nworld';
            const range = toRange(text, 0, 7);
            assert.deepStrictEqual(
                range,
                Range.create(Position.create(0, 0), Position.create(1, 1))
            );
        });

        it('should handle same start and end', () => {
            const text = 'hello';
            const range = toRange(text, 2, 2);
            assert.deepStrictEqual(
                range,
                Range.create(Position.create(0, 2), Position.create(0, 2))
            );
        });
    });

    describe('#getLangAttribute', () => {
        it('should return lang attribute', () => {
            const tag = {
                content: '',
                attributes: { lang: 'typescript' },
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag), 'typescript');
        });

        it('should return type attribute when lang is missing', () => {
            const tag = {
                content: '',
                attributes: { type: 'text/typescript' },
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag), 'typescript');
        });

        it('should prefer lang over type', () => {
            const tag = {
                content: '',
                attributes: { lang: 'scss', type: 'text/css' },
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag), 'scss');
        });

        it('should return null when no attributes', () => {
            const tag = {
                content: '',
                attributes: {},
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag), null);
        });

        it('should return null when tag is null', () => {
            assert.equal(getLangAttribute(null), null);
        });

        it('should check multiple tags and return first with lang', () => {
            const tag1 = {
                content: '',
                attributes: {},
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            const tag2 = {
                content: '',
                attributes: { lang: 'scss' },
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag1, tag2), 'scss');
        });

        it('should strip text/ prefix from type', () => {
            const tag = {
                content: '',
                attributes: { type: 'text/javascript' },
                start: 0,
                end: 0,
                startPos: Position.create(0, 0),
                endPos: Position.create(0, 0),
                container: { start: 0, end: 0 }
            };
            assert.equal(getLangAttribute(tag), 'javascript');
        });
    });

    describe('#isInsideMoustacheTag', () => {
        it('should return true when inside #if tag', () => {
            const html = '{#if condition}content';
            assert.equal(isInsideMoustacheTag(html, null, 10), true);
        });

        it('should return false after closing moustache', () => {
            const html = '{#if condition}content{/if}after';
            assert.equal(isInsideMoustacheTag(html, null, 30), false);
        });

        it('should return true when inside {:else tag', () => {
            const html = '{#if a}{:else}content';
            assert.equal(isInsideMoustacheTag(html, null, 10), true);
        });

        it('should return true when inside {@html tag', () => {
            const html = 'before{@html content';
            assert.equal(isInsideMoustacheTag(html, null, 15), true);
        });

        it('should return false before any moustache tags', () => {
            const html = 'before{#if condition}';
            assert.equal(isInsideMoustacheTag(html, null, 3), false);
        });

        it('should handle position inside tag attributes', () => {
            const html = '<div class="test {value}"></div>';
            assert.equal(isInsideMoustacheTag(html, 0, 22), true);
        });

        it('should return false when inside tag with no open moustache', () => {
            const html = '<div class="test"></div>';
            assert.equal(isInsideMoustacheTag(html, 0, 15), false);
        });

        it('should return true when open brace without close', () => {
            const html = '<div class="test {value';
            assert.equal(isInsideMoustacheTag(html, 0, 22), true);
        });
    });
});
