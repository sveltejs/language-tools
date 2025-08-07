import { describe, it, expect } from 'vitest';
import { guessTabSize } from '../../src/lib/foldingRange/indentFolding';

describe('indent based folding', () => {
    it('can guess tab size', () => {
        expect(
            guessTabSize([
                { spaceCount: 2, tabCount: 1 },
                { spaceCount: 4, tabCount: 1 },
                { spaceCount: 6, tabCount: 1 }
            ])
        ).toEqual(2);

        expect(
            guessTabSize([
                { spaceCount: 4, tabCount: 1 },
                { spaceCount: 8, tabCount: 1 },
                { spaceCount: 12, tabCount: 1 }
            ])
        ).toEqual(4);
    });

    it('can guess tab size with inconsistent mix of tab and space', () => {
        expect(
            guessTabSize([
                { spaceCount: 0, tabCount: 1 },
                { spaceCount: 2, tabCount: 1 },
                { spaceCount: 6, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ])
        ).toEqual(2);

        expect(
            guessTabSize([
                { spaceCount: 0, tabCount: 1 },
                { spaceCount: 4, tabCount: 0 },
                { spaceCount: 6, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ])
        ).toEqual(2);

        expect(
            guessTabSize([
                { spaceCount: 0, tabCount: 2 },
                { spaceCount: 4, tabCount: 0 },
                { spaceCount: 4, tabCount: 1 }
            ])
        ).toEqual(2);
    });
});
