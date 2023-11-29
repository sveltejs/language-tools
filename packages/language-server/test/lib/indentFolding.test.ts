import assert from 'assert';
import { guessTabSize } from '../../src/lib/foldingRange/indentFolding';

describe('indent based folding', () => {
    it('can guess tab size', () => {
        assert.deepStrictEqual(
            guessTabSize([
                { spaceCount: 2, tabCount: 1 },
                { spaceCount: 4, tabCount: 1 },
                { spaceCount: 6, tabCount: 1 }
            ]),
            2
        );

        assert.deepStrictEqual(
            guessTabSize([
                { spaceCount: 4, tabCount: 1 },
                { spaceCount: 8, tabCount: 1 },
                { spaceCount: 12, tabCount: 1 }
            ]),
            4
        );
    });

    it('can guess tab size with inconsistent mix of tab and space', () => {
        assert.deepStrictEqual(
            guessTabSize([
                { spaceCount: 0, tabCount: 1 },
                { spaceCount: 2, tabCount: 1 },
                { spaceCount: 6, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ]),
            2
        );

        assert.deepStrictEqual(
            guessTabSize([
                { spaceCount: 0, tabCount: 1 },
                { spaceCount: 4, tabCount: 0 },
                { spaceCount: 6, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ]),
            2
        );

        assert.deepStrictEqual(
            guessTabSize([
                { spaceCount: 0, tabCount: 2 },
                { spaceCount: 4, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ]),
            2
        );
    });
});
