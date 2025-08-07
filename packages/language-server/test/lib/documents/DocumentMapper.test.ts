import { describe, it, expect } from 'vitest';
import { FragmentMapper, positionAt } from '../../../src/lib/documents';

describe('DocumentMapper', () => {
    describe('FragmentMapper', () => {
        function setup(content: string, start: number, end: number) {
            return new FragmentMapper(
                content,
                <any>{
                    start,
                    end,
                    endPos: positionAt(end, content),
                    content: content.substring(start, end)
                },
                'file:///hello.svelte'
            );
        }

        it('isInGenerated works', () => {
            const fragment = setup('Hello, \nworld!', 8, 13);

            expect(fragment.isInGenerated({ line: 0, character: 0 })).toEqual(false);
            expect(fragment.isInGenerated({ line: 1, character: 0 })).toEqual(true);
            expect(fragment.isInGenerated({ line: 1, character: 5 })).toEqual(true);
            expect(fragment.isInGenerated({ line: 1, character: 6 })).toEqual(false);
        });

        it('calculates the position in parent', () => {
            const fragment = setup('Hello, \nworld!', 8, 13);

            expect(fragment.getOriginalPosition({ line: 0, character: 2 })).toEqual({
                line: 1,
                character: 2
            });
        });

        it('calculates the position in fragment', () => {
            const fragment = setup('Hello, \nworld!', 8, 13);

            expect(fragment.getGeneratedPosition({ line: 1, character: 2 })).toEqual({
                line: 0,
                character: 2
            });
        });
    });
});
