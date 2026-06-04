import { Document } from '../../../src/lib/documents';
import { getFoldingRanges } from '../../../src/plugins/html/getFoldingRanges';
import * as assert from 'assert';

// This test is copied from https://github.com/microsoft/vscode-html-languageservice/blob/580c051637e4029483c7f7c4457001c329099b2b/src/test/folding.test.ts

interface ExpectedIndentRange {
    startLine: number;
    endLine: number;
    kind?: string;
}

function assertRanges(lines: string[], expected: ExpectedIndentRange[], message?: string): void {
    const document = Document.createForTest('file://foo/bar.json', lines.join('\n'));
    const actual = getFoldingRanges(document, {
        lineFoldingOnly: true
    });

    let actualRanges = [];
    for (let i = 0; i < actual.length; i++) {
        actualRanges[i] = r(actual[i].startLine, actual[i].endLine, actual[i].kind);
    }
    actualRanges = actualRanges.sort((r1, r2) => r1.startLine - r2.startLine);
    assert.deepEqual(actualRanges, expected, message);
}

function r(startLine: number, endLine: number, kind?: string): ExpectedIndentRange {
    return { startLine, endLine, kind };
}

describe('getFoldingRanges mates vscode-html-languageservice', () => {
    it('Fold one level', () => {
        const input = [/*0*/ '<html>', /*1*/ 'Hello', /*2*/ '</html>'];
        assertRanges(input, [r(0, 1)]);
    });

    it('Fold two level', () => {
        const input = [
            /*0*/ '<html>',
            /*1*/ '<head>',
            /*2*/ 'Hello',
            /*3*/ '</head>',
            /*4*/ '</html>'
        ];
        assertRanges(input, [r(0, 3), r(1, 2)]);
    });

    it('Fold siblings', () => {
        const input = [
            /*0*/ '<html>',
            /*1*/ '<head>',
            /*2*/ 'Head',
            /*3*/ '</head>',
            /*4*/ '<body class="f">',
            /*5*/ 'Body',
            /*6*/ '</body>',
            /*7*/ '</html>'
        ];
        assertRanges(input, [r(0, 6), r(1, 2), r(4, 5)]);
    });

    it('Fold self-closing tags', () => {
        const input = [
            /*0*/ '<div>',
            /*1*/ '<a href="top"/>',
            /*2*/ '<img src="s">',
            /*3*/ '<br/>',
            /*4*/ '<br>',
            /*5*/ '<img class="c"',
            /*6*/ '     src="top"',
            /*7*/ '>',
            /*8*/ '</div>'
        ];
        assertRanges(input, [r(0, 7), r(5, 6)]);
    });

    it('Fold comment', () => {
        const input = [
            /*0*/ '<!--',
            /*1*/ ' multi line',
            /*2*/ '-->',
            /*3*/ '<!-- some stuff',
            /*4*/ ' some more stuff -->'
        ];
        assertRanges(input, [r(0, 2, 'comment'), r(3, 4, 'comment')]);
    });

    it('Fold regions', () => {
        const input = [
            /*0*/ '<!-- #region -->',
            /*1*/ '<!-- #region -->',
            /*2*/ '<!-- #endregion -->',
            /*3*/ '<!-- #endregion -->'
        ];
        assertRanges(input, [r(0, 3, 'region'), r(1, 2, 'region')]);
    });

    it('Fold incomplete', () => {
        const input = [
            /*0*/ '<body>',
            /*1*/ '<div></div>',
            /*2*/ 'Hello',
            /*3*/ '</div>',
            /*4*/ '</body>'
        ];
        assertRanges(input, [r(0, 3)]);
    });

    it('Fold incomplete 2', () => {
        const input = [/*0*/ '<be><div>', /*1*/ '<!-- #endregion -->', /*2*/ '</div>'];
        assertRanges(input, [r(0, 1)]);
    });

    it('Fold intersecting region', () => {
        const input = [
            /*0*/ '<body>',
            /*1*/ '<!-- #region -->',
            /*2*/ 'Hello',
            /*3*/ '<div></div>',
            /*4*/ '</body>',
            /*5*/ '<!-- #endregion -->'
        ];
        assertRanges(input, [r(0, 3)]);
    });

    it('Fold intersecting region 2', () => {
        const input = [
            /*0*/ '<!-- #region -->',
            /*1*/ '<body>',
            /*2*/ 'Hello',
            /*3*/ '<!-- #endregion -->',
            /*4*/ '<div></div>',
            /*5*/ '</body>'
        ];
        assertRanges(input, [r(0, 3, 'region')]);
    });
});
